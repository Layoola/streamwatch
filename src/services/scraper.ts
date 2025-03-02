import { Page } from "puppeteer";
import { Tweet } from "../models";
import { saveMediaWorker } from "./mediaHandler";
import logger from "../logging/logger";
import * as fs from "fs";

interface ITweet {
  text: string;
  username: string;
  timestamp: string;
  tweetId: string;
  mediaUrls: string[];
  likes: number;
  retweets: number;
  comments: number;
  hasVideo: boolean;
}

export class TwitterScraper {
  private page: Page;
  private lastKnownTweetId: string | null = null;
  private videoUrls: Set<string> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private checkpointFilePath: string;

  constructor(page: Page, checkpointFilePath: string = "./checkpoint.json") {
    this.page = page;
    this.checkpointFilePath = checkpointFilePath;
    this.loadLastKnownTweetId(); // Load the last known tweet ID on initialization
  }

  // Load the last known tweet ID from a JSON file
  private loadLastKnownTweetId(): void {
    try {
      if (fs.existsSync(this.checkpointFilePath)) {
        const data = fs.readFileSync(this.checkpointFilePath, "utf-8");
        const { lastKnownTweetId } = JSON.parse(data);
        this.lastKnownTweetId = lastKnownTweetId;
        logger.info(`Loaded last known tweet ID: ${this.lastKnownTweetId}`);
      } else {
        logger.info("No checkpoint file found. Starting from scratch.");
      }
    } catch (error) {
      logger.error("Error loading last known tweet ID:", error);
    }
  }

  // Save the last known tweet ID to a JSON file
  private saveLastKnownTweetId(): void {
    try {
      const data = JSON.stringify({ lastKnownTweetId: this.lastKnownTweetId });
      fs.writeFileSync(this.checkpointFilePath, data, "utf-8");
      logger.info(`Saved last known tweet ID: ${this.lastKnownTweetId}`);
    } catch (error) {
      logger.error("Error saving last known tweet ID:", error);
    }
  }

  // Update the last known tweet ID
  private updateLastKnownTweetId(tweetId: string): void {
    this.lastKnownTweetId = tweetId;
    this.saveLastKnownTweetId();
  }

  // Fetch missed tweets since the last known tweet ID
  async fetchMissedTweets(username: string): Promise<ITweet[]> {
    const missedTweets: ITweet[] = [];
    let maxId: string | null = null;
    let hasMoreTweets = true;

    while (hasMoreTweets) {
      try {
        const url = `https://twitter.com/${username}${
          maxId ? `?max_id=${maxId}` : ""
        }`;
        await this.page.goto(url, { waitUntil: "networkidle2" });
        await this.page.waitForSelector('article[data-testid="tweet"]');

        const tweets = await this.page.evaluate(() => {
          const tweetElements = document.querySelectorAll(
            'article[data-testid="tweet"]'
          );
          return Array.from(tweetElements).map((tweetElement) => {
            const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
            const tweetId = tweetLink
              ?.getAttribute("href")
              ?.split("/status/")[1];
            const textElement = tweetElement.querySelector(
              'div[data-testid="tweetText"]'
            );
            const timeElement = tweetElement.querySelector("time");

            return {
              text: textElement?.textContent || "",
              timestamp: timeElement?.getAttribute("datetime") || "",
              username:
                tweetElement.querySelector('div[data-testid="User-Name"]')
                  ?.textContent || "",
              tweetId: tweetId || "",
              mediaUrls: [],
              likes: 0,
              retweets: 0,
              comments: 0,
              hasVideo: false,
            };
          });
        });

        if (tweets.length === 0) {
          hasMoreTweets = false;
          break;
        }

        for (const tweet of tweets) {
          if (tweet.tweetId === this.lastKnownTweetId) {
            hasMoreTweets = false;
            break;
          }
          missedTweets.push(tweet);
        }

        maxId = tweets[tweets.length - 1].tweetId;
      } catch (error) {
        logger.error("Error fetching missed tweets:", error);
        break;
      }
    }

    return missedTweets.reverse(); // Return tweets in chronological order
  }

  // Save a tweet to the database
  private async saveTweet(tweet: ITweet): Promise<void> {
    try {
      await Tweet.create({
        id: tweet.tweetId,
        tweet_text: tweet.text,
        author: tweet.username,
        likes: tweet.likes,
        retweets: tweet.retweets,
        comments: tweet.comments,
      });

      if (tweet.mediaUrls.length > 0) {
        logger.info(`🔗 Found media for tweet ${tweet.tweetId}`);
        logger.info("Media URLs:", tweet.mediaUrls);

        logger.info("Saving media to database...");
        await saveMediaWorker(tweet.tweetId, tweet.mediaUrls, tweet.hasVideo);
      }
    } catch (error) {
      logger.error("Error saving tweet or media to database:", error);
    }
  }

  // Wait for a condition to be met
  async waitForCondition(
    conditionFn: () => Promise<boolean>,
    timeout: number,
    interval: number
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await conditionFn()) return;
      await new Promise((res) => setTimeout(res, interval));
    }
  }

  // Set up video URL interception
  private setupVideoInterception(): void {
    this.page.removeAllListeners("response");
    this.videoUrls.clear();

    this.page.on("response", async (response) => {
      const url = response.url();
      if (url.includes(".m3u8")) {
        this.videoUrls.add(url);
      }
    });
  }

  // Get video URL from a tweet ID
  async getVideoUrlFromTweetId(tweetId: string): Promise<string | null> {
    try {
      await this.page.goto(`https://twitter.com/i/web/status/${tweetId}`, {
        waitUntil: "networkidle2",
      });

      this.setupVideoInterception();

      await this.page.evaluate(() => {
        const videoPlayer = document.querySelector(
          'div[data-testid="videoPlayer"]'
        );
        if (videoPlayer) {
          (videoPlayer as HTMLElement).click();
        }
      });

      await this.waitForCondition(
        async () => {
          const videoExists = await this.page.evaluate(
            () => document.querySelector("video") !== null
          );
          return videoExists;
        },
        3000,
        500
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (this.videoUrls.size > 0) {
        return Array.from(this.videoUrls)[0];
      }

      return null;
    } catch (error) {
      logger.error("Error getting video URL from tweet ID:", error);
      return null;
    }
  }

  // Extract image URLs from a tweet
  private async extractImageUrlsFromTweet(): Promise<{ imageUrls: string[] }> {
    const imageUrlsInTweet = await this.page.evaluate(() => {
      const tweetElement = document.querySelector(
        'article[data-testid="tweet"]'
      );
      if (!tweetElement) return [];

      const imageUrls: string[] = [];
      const images = tweetElement.querySelectorAll("img[alt='Image']");
      images.forEach((img) => {
        const src = img.getAttribute("src");
        if (src) imageUrls.push(src);
      });
      return imageUrls;
    });

    return { imageUrls: imageUrlsInTweet };
  }

  // Get the latest tweet from a user
  async getLatestTweet(username: string): Promise<ITweet | null> {
    try {
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.page.goto(`https://twitter.com/${username}`);
      await this.page.waitForSelector('article[data-testid="tweet"]');

      const tweetData = await this.page.evaluate(() => {
        const tweetElement = document.querySelector(
          'article[data-testid="tweet"]'
        );
        if (!tweetElement) return null;

        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        const tweetId = tweetLink?.getAttribute("href")?.split("/status/")[1];
        const textElement = tweetElement.querySelector(
          'div[data-testid="tweetText"]'
        );
        const timeElement = tweetElement.querySelector("time");

        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username:
            tweetElement.querySelector('div[data-testid="User-Name"]')
              ?.textContent || "",
          tweetId: tweetId || "",
          mediaUrls: [] as string[],
          likes: 0,
          retweets: 0,
          comments: 0,
          hasVideo: false,
        };
      });

      if (!tweetData || !tweetData.tweetId) {
        logger.info("No valid tweet found");
        return null;
      }

      if (this.lastKnownTweetId === tweetData.tweetId) {
        logger.info("No new tweets since last check");
        return null;
      }

      const hasVideo = await this.page.evaluate(async () => {
        const tweetElement = document.querySelector(
          'article[data-testid="tweet"]'
        );
        return !!(
          tweetElement?.querySelector('div[data-testid="videoPlayer"]') ||
          tweetElement?.querySelector("video")
        );
      });

      tweetData.hasVideo = hasVideo;

      const { imageUrls } = await this.extractImageUrlsFromTweet();
      imageUrls.forEach((url) => tweetData.mediaUrls.push(url));

      if (hasVideo) {
        logger.info("⏳ Video detected, waiting for video URL to load...");
        const videoUrl = await this.getVideoUrlFromTweetId(tweetData.tweetId);
        if (videoUrl) {
          logger.info("📹 Video URL found:", videoUrl);
          tweetData.mediaUrls.push(videoUrl);
        } else {
          logger.info("Could not extract video found in tweet");
        }
      }

      if (this.lastKnownTweetId === tweetData.tweetId) {
        logger.info("No new tweets since last check");
        return null;
      }

      this.updateLastKnownTweetId(tweetData.tweetId);
      logger.info("✅ New tweet found!");
      return tweetData;
    } catch (error) {
      logger.error("Error scraping latest tweet:", error);
      return null;
    }
  }

  // Monitor for new tweets
  async monitorLatestTweets(
    username: string,
    checkInterval: number = 60000,
    onNewTweet?: (tweet: ITweet) => Promise<void>
  ): Promise<void> {
    logger.info(`Started monitoring tweets for @${username}`);
    logger.info(`Checking every ${checkInterval / 1000} seconds`);

    // Fetch missed tweets on startup
    const missedTweets = await this.fetchMissedTweets(username);
    for (const tweet of missedTweets) {
      if (onNewTweet) {
        await onNewTweet(tweet);
      } else {
        await this.saveTweet(tweet);
      }
    }

    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Initialize with the latest tweet
    await this.getLatestTweet(username);

    this.monitoringInterval = setInterval(async () => {
      try {
        const newTweet = await this.getLatestTweet(username);
        if (newTweet) {
          logger.info("New tweet found:", newTweet);

          if (onNewTweet) {
            await onNewTweet(newTweet);
          } else {
            await this.saveTweet(newTweet);
          }
        }
      } catch (error) {
        logger.error("Error in monitoring interval:", error);
      }
    }, checkInterval);
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Stopped monitoring tweets");
    }
  }
}

export const startScraping = async (page: Page, userToTrack: string) => {
  const scraper = new TwitterScraper(page);
  console.log(`✅ Monitoring tweets from @${userToTrack}...`);
  await scraper.monitorLatestTweets(userToTrack, 30000);
};
