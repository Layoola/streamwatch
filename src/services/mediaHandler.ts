import { Page } from "puppeteer";
import axios from "axios";
import { Media } from "../models";
const fs = require("fs");
const path = require("path");

const MEDIA_DIR = path.join(__dirname, "../../data/media");

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Fetch video as Base64 //this needs to be worked on before saving the video as base64
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
    console.log("m3u8Matches", m3u8Matches);
    if (m3u8Matches) {
      m3u8Matches.forEach((match) => videoSources.add(match));
    }

    // Prefer MP4 over M3U8 if available
    const urls = Array.from(videoSources);
    const mp4Url = urls.find((url) => url.includes(".mp4"));
    return mp4Url || urls[0] || null;
  });
};

//redundant to be removed
// async function handleBlobUrl(
//   page: Page,
//   blobUrl: string,
//   outputPath: string
// ): Promise<void> {
//   try {
//     // Extract video data from the blob URL
//     const videoData = await page.evaluate(async (url) => {
//       const response = await fetch(url);
//       const blob = await response.blob();
//       return new Promise((resolve) => {
//         const reader = new FileReader();
//         reader.onloadend = () => resolve(reader.result);
//         reader.readAsArrayBuffer(blob);
//       });
//     }, blobUrl);

//     // Convert ArrayBuffer to Buffer
//     const videoBuffer = Buffer.from(videoData as ArrayBuffer);

//     // Save the video buffer to a file
//     fs.writeFileSync(outputPath, videoBuffer);
//     console.log(`✅ Saved video file from blob URL at ${outputPath}`);
//   } catch (error) {
//     console.error("❌ Error handling blob URL:", error);
//     throw error;
//   }
// }

// Download video to check if the right video is being downloaded

//this is to check if the right video is being downloaded //to be removed
async function downloadVideo(
  videoUrl: string,
  outputPath: string
): Promise<void> {
  try {
    const response = await axios({
      url: videoUrl,
      method: "GET",
      responseType: "stream", // Stream the response for large files
      headers: {
        Referer: "https://twitter.com/", // Required for Twitter's referrer check
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", // Mimic a browser
      },
    });

    // Create a writable stream to save the video
    const writer = fs.createWriteStream(outputPath);

    // Pipe the response data to the file
    response.data.pipe(writer);

    // Return a promise that resolves when the file is fully written
    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("❌ Error downloading video:", error);
    throw error;
  }
}

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

  const processedUrls = new Set(); // Avoid processing duplicate URLs

  for (const mediaUrl of mediaUrls) {
    console.log("mediaUrl", mediaUrl);
    try {
      // Skip if already processed
      if (processedUrls.has(mediaUrl)) continue;
      processedUrls.add(mediaUrl);

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

        if (videoUrl) {
          console.log(`🎥 Found video URL: ${videoUrl}`);

          // const videoBase64 = await fetchVideoAsBase64(videoUrl, 30000);

          // if (videoBase64) {
          //     // Save videoBase64 to a file
          //     const videoBuffer = Buffer.from(videoBase64.split(",")[1], "base64");
          //     const videoFileName = `${tweetId}-${Date.now()}.mp4`;
          //     const videoFilePath = path.join(MEDIA_DIR, videoFileName);

          //     fs.writeFileSync(videoFilePath, videoBuffer);
          //     console.log(
          //         `✅ Saved video file for tweet ${tweetId} at ${videoFilePath}`
          //     );

          //     await Media.create({
          //         tweet_id: tweetId,
          //         media_base_64: videoBase64,
          //         media_type: "mp4",
          //     });

          //     console.log(`✅ Saved video for tweet ${tweetId}`);
          // } else {
          //     console.log(`❌ Could not fetch video for tweet ${tweetId}`);
          // }

          // } else {
          //     console.log(`❌ Could not find video URL for tweet ${tweetId}`);

          //     // Fallback: save thumbnail if video URL not found
          //     const response = await axios.get(mediaUrl, {
          //         responseType: "arraybuffer",
          //     });

          //     const mediaBase64 = Buffer.from(response.data).toString("base64");

          //     await Media.create({
          //         tweet_id: tweetId,
          //         media_base_64: mediaBase64,
          //         media_type: "jpg",
          //         // is_thumbnail: true, // Add this field to your Media model
          //     });

          //     console.log(`⚠️ Saved video thumbnail for tweet ${tweetId}`);
          // }

          //             }
          //         } catch (error) {
          //             console.error(`❌ Error saving media for tweet ${tweetId}:`, error);
          //         }
          //     }
          // };
          // Define the output path for the video
          const videoFileName = `${tweetId}-${Date.now()}.mp4`;
          const videoFilePath = path.join(MEDIA_DIR, videoFileName);

          // Download the video directly to the folder
          await downloadVideo(videoUrl, videoFilePath);

          console.log(
            `✅ Saved video file for tweet ${tweetId} at ${videoFilePath}`
          );
        } else {
          console.log(`❌ Could not find video URL for tweet ${tweetId}`);

          // Fallback: save thumbnail if video URL not found
          const response = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
          });

          const mediaBase64 = Buffer.from(response.data).toString("base64");

          await Media.create({
            tweet_id: tweetId,
            media_base_64: mediaBase64,
            media_type: "jpg",
            is_thumbnail: true, // Add this field to your Media model
          });

          console.log(`⚠️ Saved video thumbnail for tweet ${tweetId}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error saving media for tweet ${tweetId}:`, error);
    }
  }
};
