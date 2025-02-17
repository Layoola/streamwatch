// const fs = require("fs");
// const path = require("path");
//import axios from "axios";

// import { Media } from "../models";
// import { Page } from "puppeteer";

// const MEDIA_DIR = path.join(__dirname, "../..data/media");

// if (!fs.existsSync(MEDIA_DIR)) {
//   fs.mkdirSync(MEDIA_DIR, { recursive: true });
// }

// // Helper to get actual video URL from tweet
// const getVideoUrl = async (page: Page) => {
//   return await page.evaluate(async () => {
//     // First try: direct video element
//     const videoElement = document.querySelector("video");
//     if (videoElement?.src) return videoElement.src;

//     // Second try: video source elements
//     const sources = document.querySelectorAll("video source");
//     for (const source of Array.from(sources)) {
//       if (source.src) return source.src;
//     }

//     // Third try: look for m3u8 playlist in the page source
//     const matches = document.documentElement.innerHTML.match(
//       /(https:\/\/video\.twimg\.com\/[^"']+\.m3u8[^"']*)/
//     );
//     return matches ? matches[0] : null;
//   });
// };

// // export const saveMedia = async (tweetId: string, mediaUrls: string[]) => {
// //   if (!mediaUrls || mediaUrls.length === 0) {
// //     console.log("No media found for tweet:", tweetId);
// //     return;
// //   }

// //   for (const mediaUrl of mediaUrls) {
// //     try {
// //       const fileExtension = path.extname(new URL(mediaUrl).pathname);
// //       //   const fileName = `${tweetId}-${Date.now()}${fileExtension}`;
// //       //   const filePath = path.join(MEDIA_DIR, fileName);

// //       const response = await axios.get(mediaUrl, {
// //         url: mediaUrl,
// //         method: "GET",
// //         responseType: "arraybuffer",
// //       });

// //       const mediaBase64 = Buffer.from(response.data).toString("base64");
// //       //   console.log("Media saved:", mediaBase64);

// //       await Media.create({
// //         tweet_id: tweetId,
// //         media_base_64: mediaBase64,
// //         media_type: fileExtension.slice(1),
// //       });
// //     } catch (error) {
// //       console.error("Error saving media:", error);
// //     }
// //   }
// // };

// export const saveMedia = async (
//   page: Page,
//   tweetId: string,
//   mediaUrls: string[]
// ) => {
//   if (!mediaUrls || mediaUrls.length === 0) {
//     console.log("No media found for tweet:", tweetId);
//     return;
//   }

//   for (const mediaUrl of mediaUrls) {
//     try {
//       // Skip blob URLs
//       if (mediaUrl.startsWith("blob:")) {
//         continue;
//       }

//       const fileExtension = mediaUrl.split(".").pop()?.toLowerCase() || "";

//       // Handle images
//       if (["jpg", "jpeg", "png", "gif"].includes(fileExtension)) {
//         const response = await axios.get(mediaUrl, {
//           responseType: "arraybuffer",
//         });

//         const mediaBase64 = Buffer.from(response.data).toString("base64");

//         await Media.create({
//           tweet_id: tweetId,
//           media_base_64: mediaBase64,
//           media_type: fileExtension,
//         });

//         console.log(`Saved image for tweet ${tweetId}`);
//       }
//       // Handle video thumbnail - try to get actual video
//       else if (mediaUrl.includes("video_thumb")) {
//         // Get the actual video URL
//         const videoUrl = await getVideoUrl(page, tweetId);

//         if (videoUrl) {
//           const response = await axios.get(videoUrl, {
//             responseType: "arraybuffer",
//             headers: {
//               Range: "bytes=0-", // Request full video
//               "User-Agent":
//                 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
//             },
//           });

//           const videoBase64 = Buffer.from(response.data).toString("base64");

//           await Media.create({
//             tweet_id: tweetId,
//             media_base_64: videoBase64,
//             media_type: "mp4",
//           });

//           console.log(`Saved video for tweet ${tweetId}`);
//         } else {
//           console.log(`Could not find video URL for tweet ${tweetId}`);
//         }
//       }
//     } catch (error) {
//       console.error(`Error saving media for tweet ${tweetId}:`, error);
//     }
//   }
// };

async function fetchVideoAsBase64(
  videoUrl: string,
  timeout = 10000
): Promise<string | null> {
  try {
    const response = await axios.get(videoUrl, {
      responseType: "arraybuffer", // Ensures we get binary data
      timeout, // Set timeout in milliseconds
    });

    // Convert binary data to Base64
    const base64 = Buffer.from(response.data, "binary").toString("base64");

    // Construct a valid Data URL for the video
    return `data:video/mp4;base64,${base64}`;
  } catch (error: any) {
    if (axios.isCancel(error)) {
      console.error("❌ Video fetch request was canceled due to timeout.");
    } else {
      console.error("❌ Error fetching video:", error.message);
    }
    return null;
  }
}

const fs = require("fs");
const path = require("path");
import axios from "axios";
import { Page } from "puppeteer";
import { Media } from "../models";

const MEDIA_DIR = path.join(__dirname, "../..data/media");

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Enhanced video URL extraction
const getVideoUrl = async (page: Page): Promise<string | null> => {
  // Wait for video element to load
  await page
    .waitForFunction(
      () => {
        const video = document.querySelector("video");
        return (
          video && (video.readyState >= 2 || video.querySelector("source"))
        );
      },
      { timeout: 5000 }
    )
    .catch(() => console.log("Video load timeout"));

  return await page.evaluate(async () => {
    // Try all possible video sources
    const videoSources = new Set<string>();

    // 1. Direct video element source
    const videoElement = document.querySelector("video");
    if (videoElement?.src) videoSources.add(videoElement.src);

    // 2. Source elements within video
    document.querySelectorAll("video source").forEach((source) => {
      const src = source.getAttribute("src");
      if (src) videoSources.add(src);
    });

    // 3. Video player data attributes
    document
      .querySelectorAll('[data-testid="videoPlayer"]')
      .forEach((player) => {
        const dataSrc = player.getAttribute("data-video-url");
        if (dataSrc) videoSources.add(dataSrc);
      });

    // 4. M3U8 playlist in page source
    const m3u8Matches = document.documentElement.innerHTML.match(
      /(https:\/\/video\.twimg\.com\/[^"']+\.(?:m3u8|mp4)[^"']*)/g
    );
    if (m3u8Matches) {
      m3u8Matches.forEach((match) => videoSources.add(match));
    }

    // Prefer MP4 over M3U8 if available
    const urls = Array.from(videoSources);
    const mp4Url = urls.find((url) => url.includes(".mp4"));
    return mp4Url || urls[0] || null;
  });
};

export const saveMedia = async (
  page: Page,
  tweetId: string,
  mediaUrls: string[],
  hasVideo: boolean = false
) => {
  if (!mediaUrls || mediaUrls.length === 0) {
    console.log("No media found for tweet:", tweetId);
    return;
  }

  // If this is a video tweet, wait for network idle
  if (hasVideo) {
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
  }

  // Rest of your existing saveMedia code...
  // The hasVideo flag will help ensure we don't save thumbnails as images
  // when we know it's actually a video tweet

  const processedUrls = new Set(); // Avoid processing duplicate URLs

  for (const mediaUrl of mediaUrls) {
    try {
      // Skip if already processed
      if (processedUrls.has(mediaUrl)) continue;
      processedUrls.add(mediaUrl);

      // // Skip blob URLs

      const fileExtension = mediaUrl.split(".").pop()?.toLowerCase() || "";

      console.log("fileExtension", fileExtension);

      // Handle images
      if (["jpg", "jpeg", "png", "gif"].includes(fileExtension)) {
        const response = await axios.get(mediaUrl, {
          responseType: "arraybuffer",
          timeout: 10000, // 10 second timeout
        });

        const mediaBase64 = Buffer.from(response.data).toString("base64");

        await Media.create({
          tweet_id: tweetId,
          media_base_64: mediaBase64,
          media_type: fileExtension,
        });

        console.log(`✅ Saved image for tweet ${tweetId}`);
      }
      // Handle video thumbnail - try to get actual video
      else if (mediaUrl.includes("blob")) {
        // Wait for network idle to ensure video is loaded
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});

        const videoUrl = await getVideoUrl(page);

        const videoBase64 = (await fetchVideoAsBase64(
          mediaUrl,
          1000000
        )) as string;

        // Save videoBase64 to a file
        console.log(videoBase64);
        const videoBuffer = Buffer.from(videoBase64.split(",")[1], "base64");
        const videoFileName = `${tweetId}-${Date.now()}.mp4`;
        const videoFilePath = path.join(MEDIA_DIR, videoFileName);

        fs.writeFileSync(videoFilePath, videoBuffer);
        console.log(
          `✅ Saved video file for tweet ${tweetId} at ${videoFilePath}`
        );

        await Media.create({
          tweet_id: tweetId,
          media_base_64: videoBase64,
          media_type: "mp4",
        });

        console.log(`✅ Saved video for tweet ${tweetId}`);

        // if (videoUrl) {
        //   console.log(`🎥 Found video URL: ${videoUrl}`);

        //   const response = await axios.get(videoUrl, {
        //     responseType: "arraybuffer",
        //     timeout: 30000, // 30 second timeout for videos
        //     headers: {
        //       Range: "bytes=0-",
        //       "User-Agent":
        //         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        //       Accept: "*/*",
        //       "Accept-Encoding": "gzip, deflate, br",
        //       Connection: "keep-alive",
        //     },
        //   });

        //   const videoBase64 = Buffer.from(response.data).toString("base64");

        //   await Media.create({
        //     tweet_id: tweetId,
        //     media_base_64: videoBase64,
        //     media_type: "mp4",
        //   });

        //   console.log(`✅ Saved video for tweet ${tweetId}`);
        // } else {
        //   console.log(`❌ Could not find video URL for tweet ${tweetId}`);

        //   // Fallback: save thumbnail if video URL not found
        //   const response = await axios.get(mediaUrl, {
        //     responseType: "arraybuffer",
        //   });

        //   const mediaBase64 = Buffer.from(response.data).toString("base64");

        //   await Media.create({
        //     tweet_id: tweetId,
        //     media_base_64: mediaBase64,
        //     media_type: "jpg",
        //     is_thumbnail: true, // Add this field to your Media model
        //   });

        //   console.log(`⚠️ Saved video thumbnail for tweet ${tweetId}`);
        // }
      }
    } catch (error) {
      console.error(`❌ Error saving media for tweet ${tweetId}:`, error);
    }
  }
};
