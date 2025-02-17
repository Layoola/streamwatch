// import { Page } from "puppeteer";
// import { Tweet } from "../models";
// const fs = require("fs");
// import { saveMedia } from "./mediaHandler";

// interface ITweet {
//   text: string;
//   username: string;
//   timestamp: string;
//   tweetId: string;
// }
// // import * as readline from "readline";

// export class TwitterScraper {
//   private page: Page;
//   private lastKnownTweetId: string | null = null;

//   constructor(page: Page) {
//     this.page = page;
//   }

//   async initializeLastKnownTweetId(): Promise<void> {
//     try {
//       const latestTweet = await Tweet.findOne({
//         order: [["createdAt", "DESC"]], // Get the most recent tweet
//       });
//       console.log("Latest tweet from DB:", latestTweet);

//       if (latestTweet) {
//         this.lastKnownTweetId = latestTweet.id; // Assuming id is the tweetId
//       }
//     } catch (error) {
//       console.error("Error fetching latest tweet ID from DB:", error);
//     }
//   }

//   // async getLatestTweet(username: string): Promise<ITweet | null> {
//   //   try {
//   //     await this.page.goto(`https://twitter.com/${username}`);
//   //     await this.page.waitForSelector('article[data-testid="tweet"]');

//   //     const latestTweet = await this.page.evaluate(() => {
//   //       const tweetElement = document.querySelector(
//   //         'article[data-testid="tweet"]'
//   //       );
//   //       if (!tweetElement) return null;

//   //       // Get tweet ID from the link
//   //       const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
//   //       const tweetId = tweetLink?.getAttribute("href")?.split("/status/")[1];

//   //       const textElement = tweetElement.querySelector(
//   //         'div[data-testid="tweetText"]'
//   //       );
//   //       const timeElement = tweetElement.querySelector("time");
//   //       const statsElements = tweetElement.querySelectorAll(
//   //         'div[data-testid$="-count"]'
//   //       );

//   //       return {
//   //         text: textElement?.textContent || "",
//   //         timestamp: timeElement?.getAttribute("datetime") || "",
//   //         username:
//   //           tweetElement.querySelector('div[data-testid="User-Name"]')
//   //             ?.textContent || "",
//   //         tweetId: tweetId || "",
//   //       };
//   //     });

//   //     if (!latestTweet) {
//   //       console.log("No tweets found");
//   //       return null;
//   //     }

//   //     // Check if this is a new tweet
//   //     console.log(this.lastKnownTweetId, latestTweet.tweetId);
//   //     if (this.lastKnownTweetId === latestTweet.tweetId) {
//   //       console.log("No new tweets since last check");
//   //       return null;
//   //     }

//   //     this.lastKnownTweetId = latestTweet.tweetId;
//   //     console.log("✅ New tweet found!");
//   //     return latestTweet;
//   //   } catch (error) {
//   //     console.error("Error scraping latest tweet:", error);
//   //     return null;
//   //   }
//   // }

//   async getLatestTweet(username: string): Promise<ITweet | null> {
//     try {
//       console.log("working101");
//       await this.page.goto(`https://twitter.com/${username}`);
//       await this.page.waitForSelector('article[data-testid="tweet"]');

//       const latestTweet = await this.page.evaluate(() => {
//         const tweetElement = document.querySelector(
//           'article[data-testid="tweet"]'
//         );
//         if (!tweetElement) return null;

//         const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
//         const tweetId = tweetLink?.getAttribute("href")?.split("/status/")[1];

//         const textElement = tweetElement.querySelector(
//           'div[data-testid="tweetText"]'
//         );
//         const timeElement = tweetElement.querySelector("time");

//         // ✅ Extract media URLs
//         const ImageElements = tweetElement.querySelectorAll(
//           "img[alt='Image']"
//         ) as NodeListOf<HTMLMediaElement>;
//         // const videoElements = tweetElement.querySelectorAll(
//         //   "video"
//         // ) as NodeListOf<HTMLMediaElement>;
//         const videoElements = tweetElement.querySelectorAll(
//           [
//             // Direct video elements
//             "video",
//             // Video containers
//             "div[data-testid='videoPlayer']",
//             // Animated GIF containers
//             "div[data-testid='tweetPhoto'] div[role='button'][tabindex='0']",
//           ].join(",")
//         );

//         const mediaUrls: string[] = [];

//         // Extract image URLs
//         ImageElements.forEach((img) => {
//           const src = img.getAttribute("src");
//           if (src) mediaUrls.push(src);
//         });

//         // Extract video URLs
//         videoElements.forEach((videoEl) => {
//           // Check for direct video src
//           const directSrc = videoEl.getAttribute("src");
//           if (directSrc) {
//             mediaUrls.push(directSrc);
//             return;
//           }

//           // Check for source elements
//           const sources = videoEl.querySelectorAll("source");
//           sources.forEach((source) => {
//             const sourceSrc = source.getAttribute("src");
//             if (sourceSrc) mediaUrls.push(sourceSrc);
//           });

//           // Check for data attributes that might contain video URLs
//           const posterUrl = videoEl.getAttribute("poster");
//           if (posterUrl) mediaUrls.push(posterUrl);

//           // For video players, check additional data attributes
//           if (videoEl.getAttribute("data-testid") === "videoPlayer") {
//             const videoData =
//               videoEl.getAttribute("data-video-url") ||
//               videoEl.getAttribute("data-url") ||
//               videoEl.getAttribute("data-preview-image-url");
//             if (videoData) mediaUrls.push(videoData);
//           }
//         });

//         // const mediaElements = [...ImageElements, ...videoElements];

//         // const mediaUrls = Array.from(mediaElements).map((el) =>
//         //   el.getAttribute("src")
//         // );
//         return {
//           text: textElement?.textContent || "",
//           timestamp: timeElement?.getAttribute("datetime") || "",
//           username:
//             tweetElement.querySelector('div[data-testid="User-Name"]')
//               ?.textContent || "",
//           tweetId: tweetId || "",
//           mediaUrls, // ✅ Add media URLs
//         };
//       });

//       if (!latestTweet) {
//         console.log("No tweets found");
//         return null;
//       }

//       console.log(this.lastKnownTweetId, latestTweet.tweetId);
//       if (this.lastKnownTweetId === latestTweet.tweetId) {
//         console.log("No new tweets since last check");
//         return null;
//       }

//       this.lastKnownTweetId = latestTweet.tweetId;
//       console.log("✅ New tweet found!");
//       return latestTweet;
//     } catch (error) {
//       console.error("Error scraping latest tweet:", error);
//       return null;
//     }
//   }

//   // async monitorLatestTweets(
//   //   username: string,
//   //   checkInterval: number = 60000
//   // ): Promise<void> {
//   //   console.log(`Started monitoring tweets for @${username}`);
//   //   console.log(`Checking every ${checkInterval / 1000} seconds`);

//   //   // Initial check
//   //   await this.getLatestTweet(username);

//   //   // Set up periodic checking
//   //   setInterval(async () => {
//   //     const newTweet = await this.getLatestTweet(username);
//   //     if (newTweet) {
//   //       console.log("New tweet found:", newTweet);
//   //       // Save the new tweet to the database
//   //       try {
//   //         await Tweet.create({
//   //           id: newTweet.tweetId,
//   //           tweet_text: newTweet.text,
//   //           author: newTweet.username,
//   //         });
//   //       } catch (error) {
//   //         console.error("Error saving tweet to database:", error);
//   //       }
//   //       console.log("New tweet details:", newTweet);
//   //     }
//   //   }, checkInterval);
//   // }

//   async monitorLatestTweets(
//     username: string,
//     checkInterval: number = 60000
//   ): Promise<void> {
//     console.log(`Started monitoring tweets for @${username}`);
//     console.log(`Checking every ${checkInterval / 1000} seconds`);

//     await this.getLatestTweet(username);

//     setInterval(async () => {
//       const newTweet = await this.getLatestTweet(username);
//       if (newTweet) {
//         console.log("New tweet found:", newTweet);

//         try {
//           await Tweet.create({
//             id: newTweet.tweetId,
//             tweet_text: newTweet.text,
//             author: newTweet.username,
//           });

//           // ✅ Save media if present
//           // console.log(newTweet.mediaUrls);

//           if (newTweet.mediaUrls && newTweet.mediaUrls.length > 0) {
//             console.log(`🔗 Saving media for tweet ${newTweet.tweetId}`);
//             await saveMedia(this.page, newTweet.tweetId, newTweet.mediaUrls);
//           }
//         } catch (error) {
//           console.error("Error saving tweet or media to database:", error);
//         }
//       }
//     }, checkInterval);
//   }
// }

// export const startScraping = async (page: Page, userToTrack: string) => {
//   const scraper = new TwitterScraper(page);

//   console.log(`✅ Monitoring tweets from @${userToTrack}...`);
//   await scraper.monitorLatestTweets(userToTrack, 30000); // Check every 30
// };

import { Page } from "puppeteer";
import { Tweet } from "../models";
import { saveMedia } from "./mediaHandler";

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

      // Wait for media content to load
      await this.page
        .waitForFunction(
          () => {
            const video = document.querySelector("video");
            const images = document.querySelectorAll("img[alt='Image']");
            return video || images.length > 0;
          },
          { timeout: 5000 }
        )
        .catch(() => console.log("No media found or timeout"));

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

        // Collect media URLs
        const mediaUrls: string[] = [];

        // If video exists, get its sources
        if (hasVideo) {
          console.log("Has video:", videoElement);
          // Get video thumbnail
          // const videoThumb = tweetElement.querySelector(
          //   'img[src*="video_thumb"]'
          // );
          // if (videoThumb?.getAttribute("src")) {
          //   mediaUrls.push(videoThumb.getAttribute("src")!);
          // }

          // Get any available video source
          if (videoElement) {
            const sources = videoElement.querySelectorAll("source");
            sources.forEach((source) => {
              const src = source.getAttribute("src");
              if (src) mediaUrls.push(src);
            });
          }
        } else {
          // If no video, collect image URLs
          const images = tweetElement.querySelectorAll("img[alt='Image']");
          images.forEach((img) => {
            const src = img.getAttribute("src");
            if (src) mediaUrls.push(src);
          });
        }

        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username:
            tweetElement.querySelector('div[data-testid="User-Name"]')
              ?.textContent || "",
          tweetId: tweetId || "",
          mediaUrls,
          hasVideo,
        };
      });

      if (!latestTweet) {
        console.log("No tweets found");
        return null;
      }

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
            await saveMedia(
              this.page,
              newTweet.tweetId,
              newTweet.mediaUrls,
              newTweet.hasVideo
            );
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
