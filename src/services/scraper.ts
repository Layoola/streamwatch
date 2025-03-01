import { Page } from "puppeteer";
import { Tweet } from "../models";
// import { saveMedia } from "./mediaHandler";
import { response } from "express";
import { saveMedia, saveMediaWorker } from "./mediaHandler";

//friendly reminder if it works don't touch it

interface ITweet {
  text: string;
  username: string;
  timestamp: string;
  tweetId: string;
  mediaUrls: string[];
  hasVideo: boolean;
}

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
      console.error("Error getting video URL from tweet ID:", error);
      return null;
    }
  }

  //possibly edit to extract only images from tweet
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

    // const hasVideo = await this.page.evaluate(() => {
    //   const tweetElement = document.querySelector(
    //     'article[data-testid="tweet"]'
    //   );
    //   return !!(
    //     tweetElement?.querySelector('div[data-testid="videoPlayer"]') ||
    //     tweetElement?.querySelector("video")
    //   );
    // });

    return { imageUrls: imageUrlsInTweet };
  }

  //getting the latest tweet by a user
  async getLatestTweet(username: string): Promise<ITweet | null> {
    try {
      // this.setupVideoInterception();
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

        let mediaUrls: string[] = [];

        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username:
            tweetElement.querySelector('div[data-testid="User-Name"]')
              ?.textContent || "",
          tweetId: tweetId || "",
          mediaUrls: mediaUrls,
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

      tweetData.hasVideo = hasVideo; // This line is missing

      const { imageUrls } = await this.extractImageUrlsFromTweet();
      imageUrls.forEach((url) => tweetData.mediaUrls.push(url));

      let videoUrl: string | null = null;

      if (hasVideo) {
        console.log("⏳ Video detected, waiting for video URL to load...");
        // this.setupVideoInterception();
        console.log(tweetData.tweetId);
        const videoUrl = await this.getVideoUrlFromTweetId(tweetData.tweetId);
        if (videoUrl) {
          console.log("📹 Video URL found:", videoUrl);
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
      console.error("Error scraping latest tweet:", error);
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
          console.log("New tweet found:", newTweet);

          if (onNewTweet) {
            await onNewTweet(newTweet);
          } else {
            // Default behavior if no callback is provided
            try {
              await Tweet.create({
                id: newTweet.tweetId,
                tweet_text: newTweet.text,
                author: newTweet.username,
              });

              if (newTweet.mediaUrls.length > 0) {
                console.log(`🔗 Found media for tweet ${newTweet.tweetId}`);
                console.log("Media URLs:", newTweet.mediaUrls);

                console.log("Saving media to database...");

                // If you want to save media, uncomment and implement saveMedia

                await saveMediaWorker(
                  newTweet.tweetId,
                  newTweet.mediaUrls,
                  newTweet.hasVideo
                );
              }
            } catch (error) {
              console.error("Error saving tweet or media to database:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error in monitoring interval:", error);
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
  await scraper.monitorLatestTweets(userToTrack, 30000);
};
