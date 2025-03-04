import { Page } from "puppeteer";
import { Tweet } from "../models";
// import { saveMedia } from "./mediaHandler";
import { response } from "express";
import { saveMedia, saveMediaWorker } from "./mediaHandler";
import logger from "../logging/logger";
import { frequency } from "../utils/constants";
import { ITweet } from "../utils/interfaces";
//friendly reminder if it works don't touch it

export class TwitterScraper {
  private page: Page;
  private lastKnownTweetId: string | null = null;
  private videoUrls: Set<string> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  //function to wait for an event like a video to load before continuing
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

  //function to setup video interception
  private setupVideoInterception(): void {
    // Clear previous listeners to avoid duplicates
    this.page.removeAllListeners("response");
    this.videoUrls.clear();

    this.page.on("response", async (response) => {
      const url = response.url();
      if (url.includes(".m3u8")) {
        // console.log(`📹 Captured m3u8 URL: ${url}`);
        this.videoUrls.add(url);
      }

      // Capture both m3u8 and mp4 URLs for better coverage to be used in case mp4 is needed
      //  if (url.includes(".m3u8") || url.includes(".mp4")) {
      //   console.log(`📹 Captured media URL: ${url}`);
      //   this.videoUrls.add(url);
      // }
    });
  }

  async getVideoUrlFromTweetId(tweetId: string): Promise<string | null> {
    try {
      this.setupVideoInterception();

      await this.page.goto(`https://twitter.com/i/web/status/${tweetId}`, {
        waitUntil: "networkidle2",
      });

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
        30000,
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

  private async extractImageUrlsFromTweet(): Promise<{
    imageUrls: string[];
  }> {
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

  //getting the latest tweet by a user
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

        // Extract likes .....twitter DOM changes so difficult to extract data
        const likesElement = tweetElement.querySelector(
          'div[data-testid="like"] span[data-testid="app-text-transition-container"]'
        );
        const likes = likesElement
          ? parseInt(likesElement.textContent?.replace(/,/g, "") || "0", 10)
          : 0;

        // Extract retweets
        const retweetsElement = tweetElement.querySelector(
          'div[data-testid="retweet"]'
        );
        const retweets = retweetsElement
          ? parseInt(
              retweetsElement.getAttribute("aria-label")?.replace(/,/g, "") ||
                "0",
              10
            )
          : 0;

        // Extract comments (replies)
        const commentsElement = tweetElement.querySelector(
          'div[data-testid="reply"]'
        );
        const comments = commentsElement
          ? parseInt(
              commentsElement.getAttribute("aria-label")?.replace(/,/g, "") ||
                "0",
              10
            )
          : 0;

        let mediaUrls: string[] = [];

        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username:
            tweetElement.querySelector('div[data-testid="User-Name"]')
              ?.textContent || "",
          tweetId: tweetId || "",
          mediaUrls: mediaUrls,
          likes: likes,
          retweets: retweets,
          comments: comments,
          hasVideo: false,
        };
      });

      if (!tweetData || !tweetData.tweetId) {
        console.log("No valid tweet found");
        return null;
      }

      if (this.lastKnownTweetId === tweetData.tweetId) {
        console.log("No new tweets since last check");
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

      let videoUrl: string | null = null;

      if (hasVideo) {
        console.log("⏳ Video detected, waiting for video URL to load...");
        videoUrl = await this.getVideoUrlFromTweetId(tweetData.tweetId);
        if (videoUrl) {
          tweetData.mediaUrls.push(videoUrl);
        } else {
          console.log("could not extract video found in tweet");
        }
      }

      if (this.lastKnownTweetId === tweetData.tweetId) {
        console.log("No new tweets since last check");
        return null;
      }

      this.lastKnownTweetId = tweetData.tweetId;
      console.log("✅ New tweet found!");
      return tweetData;
    } catch (error) {
      logger.error("Error scraping latest tweet:", error);
      return null;
    }
  }

  async monitorLatestTweets(
    username: string,
    checkInterval: number = 60000,
    onNewTweet?: (tweet: ITweet) => Promise<void>
  ): Promise<void> {
    console.log(`Started monitoring tweets for @${username}`);
    console.log(`Checking every ${checkInterval / 1000} seconds`);

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
          console.log("New tweet found processing...");

          if (onNewTweet) {
            await onNewTweet(newTweet);
          } else {
            // Default behavior if no callback is provided
            try {
              await Tweet.create({
                id: newTweet.tweetId,
                tweet_text: newTweet.text,
                author: newTweet.username,
                likes: newTweet.likes,
                retweets: newTweet.retweets,
                comments: newTweet.comments,
              });

              if (newTweet.mediaUrls.length > 0) {
                console.log(`🔗 Found media for tweet ${newTweet.tweetId}`);

                console.log("Saving media to database...");

                await saveMedia(
                  newTweet.tweetId,
                  newTweet.mediaUrls,
                  newTweet.hasVideo
                );
              }
            } catch (error) {
              logger.error("Error saving tweet or media to database:", error);
            }
          }
        }
      } catch (error) {
        logger.error("Error in monitoring interval:", error);
      }
    }, checkInterval);
  }

  // Add a cleanup method
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("Stopped monitoring tweets");
    }
  }
}

export const startScraping = async (page: Page, userToTrack: string) => {
  const scraper = new TwitterScraper(page);
  console.log(`✅ Monitoring tweets from @${userToTrack}...`);
  await scraper.monitorLatestTweets(userToTrack, frequency);
};
