// const puppeteer = require('puppeteer');

// async function getM3u8FromTweet(tweetUrl) {
//   console.log(`Attempting to extract m3u8 link from: ${tweetUrl}`);

//   // Launch browser with required flags
//   const browser = await puppeteer.launch({
//     headless: false, // Set to true for production
//     args: ['--no-sandbox', '--disable-setuid-sandbox']
//   });

//   try {
//     const page = await browser.newPage();

//     // Enable request interception to monitor network requests
//     await page.setRequestInterception(true);

//     // Track m3u8 URLs found
//     let m3u8Urls = [];

//     // Listen for network requests
//     page.on('request', request => {
//       request.continue();
//     });

//     // Listen for responses to find m3u8 URLs
//     page.on('response', async response => {
//       const url = response.url();
//       if (url.includes('.m3u8')) {
//         console.log(`Found m3u8 URL: ${url}`);
//         m3u8Urls.push(url);
//       }
//     });

//     // Navigate to the tweet
//     console.log(`Navigating to tweet...`);
//     await page.goto(tweetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

//     // Wait for video to appear and interact with it to trigger playback
//     console.log(`Looking for video element...`);
//     await page.waitForSelector('video', { timeout: 30000 });

//     // Click on the video to start playback
//     await page.click('video');

//     // Wait for a moment to capture network requests
//     console.log(`Waiting for m3u8 requests...`);
//     await new Promise(resolve => setTimeout(resolve, 5000));

//     // If no m3u8 URLs were found in the network requests, try to get them from media source
//     if (m3u8Urls.length === 0) {
//       console.log(`No m3u8 URLs found in network requests. Trying alternative method...`);

//       // Execute JavaScript in the page context to get media sources
//       const mediaUrls = await page.evaluate(() => {
//         const videoElements = Array.from(document.querySelectorAll('video'));
//         return videoElements.map(video => {
//           if (video.src && video.src.includes('.m3u8')) {
//             return video.src;
//           }
//           return null;
//         }).filter(url => url !== null);
//       });

//       m3u8Urls = [...m3u8Urls, ...mediaUrls];
//     }

//     console.log(`Found ${m3u8Urls.length} m3u8 URLs`);

//     return m3u8Urls;
//   } catch (error) {
//     console.error(`Error: ${error.message}`);
//     return [];
//   } finally {
//     await browser.close();
//   }
// }

// // Example usage
// async function main() {
//   const tweetUrl = "https://x.com/TheFigen_/status/1894434297672581270";
//   const m3u8Urls = await getM3u8FromTweet(tweetUrl);

//   if (m3u8Urls.length > 0) {
//     console.log('Found m3u8 URLs:');
//     m3u8Urls.forEach((url, index) => {
//       console.log(`${index + 1}. ${url}`);
//     });
//   } else {
//     console.log('No m3u8 URLs found.');
//   }
// }

// main().catch(console.error);

// import { Page } from "puppeteer";
// import { Tweet } from "../src/models";

// interface ITweet {
//   text: string;
//   username: string;
//   timestamp: string;
//   tweetId: string;
//   mediaUrls: string[];
//   hasVideo: boolean;
// }

// export class TwitterScraper {
//   private page: Page;
//   private lastKnownTweetId: string | null = null;
//   private videoUrls: Set<string> = new Set();
//   private monitoringInterval: NodeJS.Timeout | null = null;

//   constructor(page: Page) {
//     this.page = page;
//   }

//   async waitForCondition(
//     conditionFn: () => Promise<boolean>,
//     timeout: number,
//     interval: number
//   ): Promise<boolean> {
//     const start = Date.now();
//     while (Date.now() - start < timeout) {
//       if (await conditionFn()) return true;
//       await new Promise((res) => setTimeout(res, interval));
//     }
//     return false; // Timeout reached without condition being met
//   }

//   private setupVideoInterception(): void {
//     // Clear previous listeners to avoid duplicates
//     this.page.removeAllListeners("response");
//     this.videoUrls.clear();

//     this.page.on("response", async (response) => {
//       const url = response.url();
//       // Capture both m3u8 and mp4 URLs for better coverage
//       if (url.includes(".m3u8") || url.includes(".mp4")) {
//         console.log(`📹 Captured media URL: ${url}`);
//         this.videoUrls.add(url);
//       }
//     });
//   }

//   /**
//    * Extract video URLs directly from a specific tweet by tweet ID
//    */
//   async getVideoUrlFromTweet(tweetId: string): Promise<string | null> {
//     try {
//       this.setupVideoInterception();
//       await this.page.goto(`https://twitter.com/i/status/${tweetId}`, {
//         waitUntil: "networkidle2",
//       });

//       // Check if video exists in the tweet
//       const hasVideo = await this.page.evaluate(() => {
//         return !!(
//           document.querySelector('div[data-testid="videoPlayer"]') ||
//           document.querySelector("video")
//         );
//       });

//       if (!hasVideo) {
//         console.log("No video found in this tweet");
//         return null;
//       }

//       // Try to interact with the video to trigger loading
//       await this.page.evaluate(() => {
//         const videoPlayer = document.querySelector(
//           'div[data-testid="videoPlayer"]'
//         );
//         if (videoPlayer) {
//           (videoPlayer as HTMLElement).click();
//         }
//       });

//       // Wait for video element to appear and possibly load
//       await this.waitForCondition(
//         async () => {
//           const videoExists = await this.page.evaluate(
//             () => document.querySelector("video") !== null
//           );
//           return videoExists;
//         },
//         8000, // Longer timeout for video loading
//         500
//       );

//       // Wait a moment to collect URLs
//       // await this.page.waitForTimeout(3000);
//       await new Promise((res) => setTimeout(res, 3000));

//       // If we've captured any video URLs, return the first one
//       if (this.videoUrls.size > 0) {
//         return Array.from(this.videoUrls)[0];
//       }

//       // Fallback: try to extract video URL from the DOM
//       const srcFromDOM = await this.page.evaluate(() => {
//         const video = document.querySelector("video");
//         if (video && video.src) return video.src;

//         // Look for source elements
//         const source = document.querySelector("video > source");
//         if (source && source.src) return source.src;

//         return null;
//       });

//       return srcFromDOM;
//     } catch (error) {
//       console.error("Error extracting video URL from tweet:", error);
//       return null;
//     }
//   }

//   /**
//    * Get all media (images and videos) from a tweet
//    */
//   private async extractMediaFromTweet(): Promise<{
//     mediaUrls: string[];
//     hasVideo: boolean;
//   }> {
//     // First get all images
//     const imageUrls = await this.page.evaluate(() => {
//       const tweetElement = document.querySelector(
//         'article[data-testid="tweet"]'
//       );
//       if (!tweetElement) return [];

//       const mediaUrls: string[] = [];
//       // Get all images with good quality
//       const images = tweetElement.querySelectorAll("img[alt='Image']");
//       images.forEach((img) => {
//         let src = img.getAttribute("src");
//         if (src) {
//           // Try to get higher quality version by modifying URL
//           src = src.replace(/&name=small$/, "&name=large");
//           mediaUrls.push(src);
//         }
//       });

//       return mediaUrls;
//     });

//     // Check if there's video content
//     const hasVideo = await this.page.evaluate(() => {
//       const tweetElement = document.querySelector(
//         'article[data-testid="tweet"]'
//       );
//       return !!(
//         tweetElement?.querySelector('div[data-testid="videoPlayer"]') ||
//         tweetElement?.querySelector("video")
//       );
//     });

//     return { mediaUrls: imageUrls, hasVideo };
//   }

//   async getLatestTweet(username: string): Promise<ITweet | null> {
//     try {
//       // this.setupVideoInterception();

//       // Navigate to user profile and reset scroll position
//       await this.page.evaluate(() => {
//         window.scrollTo(0, 0);
//       });

//       await this.page.goto(`https://twitter.com/${username}`, {
//         waitUntil: "networkidle2",
//       });

//       await this.page.waitForSelector('article[data-testid="tweet"]');

//       // Extract the basic tweet data
//       const tweetData = await this.page.evaluate(() => {
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

//         return {
//           text: textElement?.textContent || "",
//           timestamp: timeElement?.getAttribute("datetime") || "",
//           username:
//             tweetElement.querySelector('div[data-testid="User-Name"]')
//               ?.textContent || "",
//           tweetId: tweetId || "",
//           mediaUrls: [],
//           hasVideo: false,
//         };
//       });

//       if (!tweetData || !tweetData.tweetId) {
//         console.log("No valid tweet found");
//         return null;
//       }

//       // If this is a tweet we've already seen, don't process it again
//       if (this.lastKnownTweetId === tweetData.tweetId) {
//         console.log("No new tweets since last check");
//         return null;
//       }

//       // Extract media information
//       const { mediaUrls, hasVideo } = await this.extractMediaFromTweet();
//       console.log("🖼️ Found media URLs:", mediaUrls);
//       tweetData.mediaUrls = mediaUrls;
//       tweetData.hasVideo = hasVideo;

//       // If there's a video, we need to extract its URL
//       if (hasVideo) {
//         console.log("⏳ Video detected, extracting video URL...");

//         // Navigate directly to the tweet to better handle video content
//         const videoUrl = await this.getVideoUrlFromTweet(tweetData.tweetId);

//         if (videoUrl) {
//           console.log(`✅ Found video URL: ${videoUrl}`);
//           tweetData.mediaUrls.push(videoUrl);
//         } else {
//           console.log("⚠️ Could not extract video URL");
//         }
//       }

//       // Update the last known tweet ID
//       this.lastKnownTweetId = tweetData.tweetId;
//       console.log("✅ New tweet found with ID:", tweetData.tweetId);

//       return tweetData;
//     } catch (error) {
//       console.error("Error scraping latest tweet:", error);
//       return null;
//     }
//   }

//   async monitorLatestTweets(
//     username: string,
//     checkInterval: number = 60000,
//     onNewTweet?: (tweet: ITweet) => Promise<void>
//   ): Promise<void> {
//     console.log(`Started monitoring tweets for @${username}`);
//     console.log(`Checking every ${checkInterval / 1000} seconds`);

//     // Clear any existing interval
//     if (this.monitoringInterval) {
//       clearInterval(this.monitoringInterval);
//     }

//     // Initialize with the latest tweet
//     await this.getLatestTweet(username);

//     this.monitoringInterval = setInterval(async () => {
//       try {
//         const newTweet = await this.getLatestTweet(username);
//         if (newTweet) {
//           console.log("New tweet found:", newTweet);

//           if (onNewTweet) {
//             await onNewTweet(newTweet);
//           } else {
//             // Default behavior if no callback is provided
//             try {
//               await Tweet.create({
//                 id: newTweet.tweetId,
//                 tweet_text: newTweet.text,
//                 author: newTweet.username,
//               });

//               if (newTweet.mediaUrls.length > 0) {
//                 console.log(`🔗 Found media for tweet ${newTweet.tweetId}`);
//                 console.log("Media URLs:", newTweet.mediaUrls);

//                 // If you want to save media, uncomment and implement saveMedia
//                 // await saveMedia(
//                 //   this.page,
//                 //   newTweet.tweetId,
//                 //   newTweet.mediaUrls,
//                 //   newTweet.hasVideo
//                 // );
//               }
//             } catch (error) {
//               console.error("Error saving tweet or media to database:", error);
//             }
//           }
//         }
//       } catch (error) {
//         console.error("Error in monitoring interval:", error);
//       }
//     }, checkInterval);
//   }

//   // Add a cleanup method
//   stopMonitoring(): void {
//     if (this.monitoringInterval) {
//       clearInterval(this.monitoringInterval);
//       this.monitoringInterval = null;
//       console.log("Stopped monitoring tweets");
//     }
//   }
// }

// export const startScraping = async (page: Page, userToTrack: string) => {
//   const scraper = new TwitterScraper(page);
//   console.log(`✅ Monitoring tweets from @${userToTrack}...`);
//   await scraper.monitorLatestTweets(userToTrack, 30000);
// };

// import twitter from "../src/config/puppeteer";
// // import { startScraping } from '../src/services/scraper';
// import initializeDatabase from "../src/setup";
// import * as readline from "readline";
// const minimist = require("minimist");

// (async () => {
//   console.log("🚀 Starting database initialization...");
//   await initializeDatabase();
//   console.log("✅ Database initialized successfully!");
//   const args = minimist(process.argv.slice(2));
//   const username = args.username || args.u;
//   const password = args.password || args.p;

//   if (!username || !password) {
//     console.error(
//       "Usage: node script.js --username=<your_username> --password=<your_password>"
//     );
//     // process.exit(1);
//   }
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });
//   console.log("🚀 Starting Twitter scraper...");
//   rl.question("Enter the Twitter userToTrack to monitor: ", async (input) => {
//     const userToTrack = input.trim();
//     if (!userToTrack) {
//       console.log("❌ userToTrack cannot be empty.");
//       // process.exit(1);
//     }

//     await twitter.initialize();
//     const result = await twitter.login(username, password);

//     if (result) {
//       const { page } = result;
//       await startScraping(page, userToTrack);
//       rl.close();
//     }
//   });
// })();

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

//function to get a video from a tweet with Id

// const ffmpegPath = require("ffmpeg-static");
// const ffmpeg = require("fluent-ffmpeg");

// ffmpeg.setFfmpegPath(ffmpegPath);

// const url =
//   "https://video.twimg.com/ext_tw_video/1889699921579712512/pu/pl/6HqjDeWUjQjZYyi2.m3u8";

// ffmpeg(url)
//   .output("output.mp4")
//   .on("end", () => console.log("✅ Download complete!"))
//   .on("error", (err) => console.error("Error:", err))
//   .run();

// #!/usr/bin/env node

// #!/usr/bin/env node

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { promisify } from "util";

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Function to prompt user for input
 */
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Function to check if ffmpeg is installed
 */
function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", ["-version"]);

    ffmpeg.on("error", () => {
      console.error(
        "Error: ffmpeg is not installed or not in PATH. Please install ffmpeg first."
      );
      resolve(false);
    });

    ffmpeg.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Function to download m3u8 to temporary file and convert to base64
 */
async function convertM3u8ToBase64(
  url: string,
  outputBase64File: string
): Promise<void> {
  // Create a temporary file for the video
  const tempFile = `temp_${Date.now()}.mp4`;
  console.log(`Processing ${url}...`);

  try {
    // Download the video to a temporary file
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        url,
        "-c",
        "copy", // Copy without re-encoding
        "-bsf:a",
        "aac_adtstoasc", // Fix for some audio streams
        tempFile,
      ]);

      // Log progress
      let progressLine = "";
      ffmpeg.stderr.on("data", (data) => {
        const output = data.toString();
        if (output.includes("frame=") || output.includes("speed=")) {
          progressLine = output.split("\n")[0].trim();
          process.stdout.write(`\r${progressLine}`);
        } else if (!output.includes("Press [q] to stop")) {
          // Filter out common noisy messages
          console.error(output);
        }
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          console.log(`\nVideo downloaded to temporary file.`);
          resolve();
        } else {
          console.error(`\nError downloading video. Exit code: ${code}`);
          reject(new Error("FFMPEG process failed"));
        }
      });

      ffmpeg.on("error", (err) => {
        console.error(`Error spawning ffmpeg process: ${err.message}`);
        reject(err);
      });
    });

    // Read the file and convert to base64
    console.log(
      "Converting to base64... (this may take some time for large videos)"
    );
    const videoBuffer = await readFileAsync(tempFile);
    const base64Data = videoBuffer.toString("base64");

    // Save base64 to output file
    await writeFileAsync(outputBase64File, base64Data);
    console.log(`Base64 data saved to ${outputBase64File}`);

    // Show file size information
    const originalSize = videoBuffer.length;
    const base64Size = base64Data.length;
    console.log(
      `Original video size: ${(originalSize / (1024 * 1024)).toFixed(2)} MB`
    );
    console.log(`Base64 size: ${(base64Size / (1024 * 1024)).toFixed(2)} MB`);

    // Clean up temporary file
    await unlinkAsync(tempFile);
    console.log("Temporary file removed.");
  } catch (error) {
    // Make sure to clean up temp file if it exists
    if (fs.existsSync(tempFile)) {
      await unlinkAsync(tempFile);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    console.log("=== M3U8 to Base64 Converter ===");

    // Check if ffmpeg is installed
    const ffmpegInstalled = await checkFfmpeg();
    if (!ffmpegInstalled) {
      rl.close();
      process.exit(1);
    }

    // Get URL from command line args or prompt user
    let m3u8Url = "";
    if (process.argv.length > 2) {
      m3u8Url = process.argv[2];
    } else {
      m3u8Url = await prompt("Enter the m3u8 URL: ");
    }

    if (!m3u8Url) {
      console.error("Error: No URL provided");
      rl.close();
      process.exit(1);
    }

    // Get output filename from command line args or prompt user
    let outputFile = "";
    if (process.argv.length > 3) {
      outputFile = process.argv[3];
    } else {
      const defaultOutput = "video_base64.txt";
      const outputPrompt = await prompt(
        `Enter output filename for base64 data (default: ${defaultOutput}): `
      );
      outputFile = outputPrompt.trim() || defaultOutput;
    }

    // Add .txt extension if no extension provided
    if (!path.extname(outputFile)) {
      outputFile += ".txt";
    }

    // Convert video to base64
    await convertM3u8ToBase64(m3u8Url, outputFile);

    console.log("\nProcess completed successfully!");
    rl.close();
  } catch (error) {
    console.error(
      `An error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    rl.close();
    process.exit(1);
  }
}

// Run the main function
main();
