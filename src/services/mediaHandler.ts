import { Page } from "puppeteer";
import axios from "axios";
import { Media } from "../models";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { promises } from "dns";
import { promisify } from "util";

const MEDIA_DIR = path.join(__dirname, "../../data/media");
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-version"]);
    ffmpeg.on("error", () => {
      console.error("❌ FFmpeg not found in PATH. Please install FFmpeg.");
      resolve(false);
    });
    ffmpeg.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

// Fetch video as Base64 //this needs to be worked on before saving the video as base64
async function convertM3u8ToBase64(
  url: string,
  outputBase64File: string = "outputBase64File.txt"
): Promise<{ base64Data: string; tempFile: string }> {
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

    return { base64Data, tempFile };
  } catch (error) {
    // Make sure to clean up temp file if it exists
    // if (fs.existsSync(tempFile)) {
    //   await unlinkAsync(tempFile);
    // }
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

  const processedUrls = new Set(); // Avoid processing duplicate URLs

  for (const mediaUrl of mediaUrls) {
    console.log("mediaUrl", mediaUrl);
    try {
      // Skip if already processed
      if (processedUrls.has(mediaUrl)) continue;
      processedUrls.add(mediaUrl);

      // const fileExtension = mediaUrl.split(".").pop()?.toLowerCase() || "";

      const urlParts = mediaUrl.split("?")[0]; // Remove query parameters
      const fileExtension = urlParts.split(".").pop()?.toLowerCase() || "";

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
      // Handle videos
      else if (["m3u8"].includes(fileExtension) && hasVideo) {
        // Check for FFmpeg
        const ffmpegAvailable = await checkFfmpeg();
        if (!ffmpegAvailable) {
          console.error("❌ Skipping video download. FFmpeg not found.");
          continue;
        }

        // Convert M3U8 to Base64
        const { base64Data, tempFile } = await convertM3u8ToBase64(mediaUrl);

        // Save to database
        await Media.create({
          tweet_id: tweetId,
          media_base_64: base64Data,
          media_type: "mp4",
        });

        // Clean up temp file
        await unlinkAsync(tempFile);

        console.log(`✅ Saved video for tweet ${tweetId}`);
      }
    } catch (error) {
      console.error(`❌ Error saving media for tweet ${tweetId}:`, error);
    }
  }
};
