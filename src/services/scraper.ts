import { Page } from "puppeteer";
import { Tweet } from "../models";
import { saveMedia } from "./mediaHandler";
import { response } from "express";

//friendly reminder if it works don't touch it

interface ITweet {
  text: string;
  username: string;
  timestamp: string;
  tweetId: string;
  mediaUrls: string[];
  hasVideo: boolean; // Add this flag
}

export class TwitterScraper {
  private page: Page;
  private lastKnownTweetId: string | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async initializeLastKnownTweetId(): Promise<void> {
    try {
      const latestTweet = await Tweet.findOne({
        order: [["createdAt", "DESC"]],
      });
      if (latestTweet) {
        //@ts-ignore
        this.lastKnownTweetId = latestTweet.id;
      }
    } catch (error) {
      console.error("Error fetching latest tweet ID from DB:", error);
    }
  }

  async getLatestTweet(username: string): Promise<ITweet | null> {
    try {
      await this.page.goto(`https://twitter.com/${username}`);
      await this.page.waitForSelector('article[data-testid="tweet"]');

      const videoUrls: string[] = [];

      const latestTweet = await this.page.evaluate(() => {
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

        // Check for video content first
        const videoPlayer = tweetElement.querySelector(
          'div[data-testid="videoPlayer"]'
        );
        const videoElement = tweetElement.querySelector("video");
        const hasVideo = !!(videoPlayer || videoElement);
        //   console.log("Has video:", videoElement);

        const mediaUrls: string[] = [];
        //restore this //might not be needed
        // If video exists, get its sources
        console.log("Has video bool:", hasVideo);

        if (hasVideo) {
          // Get video thumbnail
          const videoThumb = tweetElement.querySelector(
            'img[src*="video_thumb"]'
          );
          if (videoThumb?.getAttribute("src")) {
            mediaUrls.push(videoThumb.getAttribute("src")!);
          }

          // Get any available video source
          if (videoElement) {
            const sources = videoElement.querySelectorAll("source");
            sources.forEach((source) => {
              const src = source.getAttribute("src");
              if (src) mediaUrls.push(src);
            });
          }
          // } else {
          //   // If no video, collect image URLs
          const images = tweetElement.querySelectorAll("img[alt='Image']");
          images.forEach((img) => {
            const src = img.getAttribute("src");
            if (src) mediaUrls.push(src);
          });
          // }
        }
        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username:
            tweetElement.querySelector('div[data-testid="User-Name"]')
              ?.textContent || "",
          tweetId: tweetId || "",
          tweetLink: tweetLink || "",
          mediaUrls,
          hasVideo,
        };
      });

      if (!latestTweet) {
        console.log("No tweets found");
        return null;
      }

      if (videoUrls.length > 0) {
        latestTweet.mediaUrls.push(...videoUrls);
      }
      console.log("mediaUrls", latestTweet.mediaUrls);

      if (this.lastKnownTweetId === latestTweet.tweetId) {
        console.log("No new tweets since last check");
        return null;
      }

      this.lastKnownTweetId = latestTweet.tweetId;
      console.log("✅ New tweet found!");
      return latestTweet;
    } catch (error) {
      console.error("Error scraping latest tweet:", error);
      return null;
    }
  }

  async monitorLatestTweets(
    username: string,
    checkInterval: number = 60000
  ): Promise<void> {
    console.log(`Started monitoring tweets for @${username}`);
    console.log(`Checking every ${checkInterval / 1000} seconds`);

    await this.getLatestTweet(username);

    setInterval(async () => {
      const newTweet = await this.getLatestTweet(username);
      if (newTweet) {
        console.log("New tweet found:", newTweet);

        try {
          await Tweet.create({
            id: newTweet.tweetId,
            tweet_text: newTweet.text,
            author: newTweet.username,
          });

          if (newTweet.mediaUrls && newTweet.mediaUrls.length > 0) {
            console.log(`🔗 Saving media for tweet ${newTweet.tweetId}`);
            // Wait for video player to fully load if it's a video
            if (newTweet.hasVideo) {
              console.log("Waiting for video to load...");
              await this.page
                .waitForFunction(
                  () => {
                    const video = document.querySelector("video");
                    return video && video.readyState >= 2;
                  },
                  { timeout: 5000 }
                )
                .catch(() => console.log("Video load timeout"));
            }

            console.log("newTweet.mediaUrls", newTweet.mediaUrls);
            // await saveMedia(
            //   this.page,
            //   newTweet.tweetId,
            //   newTweet.mediaUrls,
            //   newTweet.hasVideo
            // );
          }
        } catch (error) {
          console.error("Error saving tweet or media to database:", error);
        }
      }
    }, checkInterval);
  }
}

export const startScraping = async (page: Page, userToTrack: string) => {
  const scraper = new TwitterScraper(page);
  console.log(`✅ Monitoring tweets from @${userToTrack}...`);
  await scraper.monitorLatestTweets(userToTrack, 30000);
};
