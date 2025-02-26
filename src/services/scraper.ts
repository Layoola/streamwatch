import { Page } from "puppeteer";
import { Tweet } from "../models";
// import { saveMedia } from "./mediaHandler";
import { response } from "express";

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
  async waitForCondition(conditionFn: () => Promise<boolean>, timeout: number, interval: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await conditionFn()) return;
      await new Promise(res => setTimeout(res, interval));
    }
  }
  

  private setupVideoInterception(): void {
    // Clear previous listeners to avoid duplicates
    this.page.removeAllListeners('response');
    this.videoUrls.clear();

    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.m3u8')) {
        this.videoUrls.add(url);
      }
    });
  }

  // async getLatestTweet(username: string): Promise<ITweet | null> {
  //   try {
  //     this.setupVideoInterception();

  //     await this.page.goto(`https://twitter.com/${username}`);
  //     await this.page.waitForSelector('article[data-testid="tweet"]');

  //     // First, check if there's a video in the tweet
  //     const hasVideo = await this.page.evaluate(() => {
  //       const tweetElement = document.querySelector('article[data-testid="tweet"]');
  //       return !!(
  //         tweetElement?.querySelector('div[data-testid="videoPlayer"]') ||
  //         tweetElement?.querySelector('video')
  //       );
  //     });

  //     let videoUrl: string | null = null;
  //     if (hasVideo) {
  //       // Wait for video to load and capture m3u8 URL
  //       videoUrl = await Promise.race([
  //         new Promise<string>((resolve) => {
  //           const checkVideoUrls = setInterval(() => {
  //             if (this.videoUrls.size > 0) {
  //               clearInterval(checkVideoUrls);
  //               resolve(Array.from(this.videoUrls)[0]);
  //             }
  //           }, 100);
  //         }),
  //         new Promise<string>((_, reject) => 
  //           setTimeout(() => reject('Video URL timeout'), 5000)
  //         )
  //       ]).catch((error) => {
  //         console.log('Error capturing video URL:', error);
  //         return null;
  //       });
  //     }

  //     const tweetData = await this.page.evaluate(() => {
  //       const tweetElement = document.querySelector('article[data-testid="tweet"]');
  //       if (!tweetElement) return null;

  //       const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
  //       const tweetId = tweetLink?.getAttribute("href")?.split("/status/")[1];
  //       const textElement = tweetElement.querySelector('div[data-testid="tweetText"]');
  //       const timeElement = tweetElement.querySelector("time");

  //       // Collect image URLs
  //       const mediaUrls: string[] = [];
  //       const images = tweetElement.querySelectorAll("img[alt='Image']");
  //       images.forEach((img) => {
  //         const src = img.getAttribute("src");
  //         if (src) mediaUrls.push(src);
  //       });

  //       return {
  //         text: textElement?.textContent || "",
  //         timestamp: timeElement?.getAttribute("datetime") || "",
  //         username: tweetElement.querySelector('div[data-testid="User-Name"]')?.textContent || "",
  //         tweetId: tweetId || "",
  //         mediaUrls,
  //         hasVideo: false  // We'll set this later
  //       };
  //     });

  //     if (!tweetData) return null;

  //     // Add video URL if found
  //     if (videoUrl) {
  //       tweetData.mediaUrls.push(videoUrl);
  //       tweetData.hasVideo = true;
  //     }

  //     if (this.lastKnownTweetId === tweetData.tweetId) {
  //       console.log("No new tweets since last check");
  //       return null;
  //     }

  //     this.lastKnownTweetId = tweetData.tweetId;
  //     console.log("✅ New tweet found!");
  //     return tweetData;
  //   } catch (error) {
  //     console.error("Error scraping latest tweet:", error);
  //     return null;
  //   }
  // }

  async getLatestTweet(username: string): Promise<ITweet | null> {
    try {
      // this.setupVideoInterception();
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.page.goto(`https://twitter.com/${username}`);
      await this.page.waitForSelector('article[data-testid="tweet"]');

      const hasVideo = await this.page.evaluate(async() => {
        const tweetElement = document.querySelector('article[data-testid="tweet"]');
        return !!(
          tweetElement?.querySelector('div[data-testid="videoPlayer"]') ||
          tweetElement?.querySelector('video')
        );});

      let videoUrl: string | null = null;

      if (hasVideo) {
        console.log("⏳ Video detected, waiting for video URL to load...");
        this.setupVideoInterception();

        await this.page.reload();
        await this.page.waitForSelector('article[data-testid="tweet"]');
      
        // Wait for some time (e.g., 3 seconds) to allow video to load
        await this.waitForCondition(async () => {
          return await this.page.evaluate(() => 
            document.querySelector('video') !== null
          );
        }, 5000, 500);
        
        
        // await this.page.waitForTimeout(3000);
        videoUrl = await Promise.race([
          new Promise<string>((resolve) => {
            const checkVideoUrls = setInterval(() => {
              if (this.videoUrls.size > 0) {
                clearInterval(checkVideoUrls);
                resolve(Array.from(this.videoUrls)[0]);
              }
            }, 3000);
          }),
          new Promise<string>((_, reject) => 
            setTimeout(() => reject('Video URL timeout'), 5000)
          )]).catch(() => null);
      }

      const tweetData = await this.page.evaluate(() => {
        const tweetElement = document.querySelector('article[data-testid="tweet"]');
        if (!tweetElement) return null;
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        const tweetId = tweetLink?.getAttribute("href")?.split("/status/")[1];
        const textElement = tweetElement.querySelector('div[data-testid="tweetText"]');
        const timeElement = tweetElement.querySelector("time");
        const mediaUrls: string[] = [];
        const images = tweetElement.querySelectorAll("img[alt='Image']");
        images.forEach((img) => {
          const src = img.getAttribute("src");
          if (src) mediaUrls.push(src);
        });

      
        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username: tweetElement.querySelector('div[data-testid="User-Name"]')?.textContent || "",
          tweetId: tweetId || "",
          mediaUrls,
          hasVideo: false
        };
      });

      // if (videoUrl) {
      //   tweetData?.mediaUrls.push(videoUrl);
      //   tweetData.hasVideo = true;
      // }

      if (!tweetData) return null;

      if (videoUrl) {
        tweetData.mediaUrls.push(videoUrl);
        tweetData.hasVideo = true;
      }
  
      if (this.lastKnownTweetId === tweetData.tweetId) {
        console.log("No new tweets since last check");
        return null;
      }
  
      this.lastKnownTweetId = tweetData.tweetId;
      console.log("✅ New tweet found!");
      return tweetData;
    }catch (error) {
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
                
                // If you want to save media, uncomment and implement saveMedia
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
