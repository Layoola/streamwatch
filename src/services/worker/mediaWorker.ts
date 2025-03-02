import { parentPort, workerData } from "worker_threads";
import axios from "axios";
const { Media } = require("../../models"); 
//import { checkFfmpeg, convertM3u8ToBase64, unlinkAsync } from "./ffmpegUtils"; // Adjust import as needed
import { checkFfmpeg, convertM3u8ToBase64, unlinkAsync } from "../mediaHandler";



interface SaveMediaParams {
  tweetId: string;
  mediaUrls: string[];
  hasVideo: boolean;
}

async function saveMedia({ tweetId, mediaUrls, hasVideo }: SaveMediaParams) {
  if (!mediaUrls || mediaUrls.length === 0) {
    parentPort?.postMessage({
      status: "error",
      message: `No media found for tweet ${tweetId}`,
    });
    return;
  }

  const processedUrls = new Set();

  for (const mediaUrl of mediaUrls) {
    if (processedUrls.has(mediaUrl)) continue;
    processedUrls.add(mediaUrl);

    const urlParts = mediaUrl.split("?")[0];
    const fileExtension = urlParts.split(".").pop()?.toLowerCase() || "";

    try {
      if (["jpg", "jpeg", "png", "gif"].includes(fileExtension)) {
        const response = await axios.get(mediaUrl, {
          responseType: "arraybuffer",
          timeout: 10000,
        });

        const mediaBase64 = Buffer.from(response.data).toString("base64");

        await Media.create({
          tweet_id: tweetId,
          media_base_64: mediaBase64,
          media_type: fileExtension,
        });

        parentPort?.postMessage({
          status: "success",
          message: `✅ Saved image for tweet ${tweetId}`,
        });
      } else if (["m3u8"].includes(fileExtension) && hasVideo) {
        const ffmpegAvailable = await checkFfmpeg();
        if (!ffmpegAvailable) {
          parentPort?.postMessage({
            status: "error",
            message: `❌ Skipping video download. FFmpeg not found.`,
          });
          continue;
        }

        const { base64Data, tempFile } = await convertM3u8ToBase64(mediaUrl);

        await Media.create({
          tweet_id: tweetId,
          media_base_64: base64Data,
          media_type: "mp4",
        });

        await unlinkAsync(tempFile);
        parentPort?.postMessage({
          status: "success",
          message: `✅ Saved video for tweet ${tweetId}`,
        });
      }
    } catch (error) {
      parentPort?.postMessage({
        status: "error",
        message: `❌ Error saving media for tweet ${tweetId}: ${(error as Error).message}`,
      });
    }
  }

  parentPort?.postMessage({
    status: "done",
    message: `✅ Completed media processing for tweet ${tweetId}`,
  });
}

saveMedia(workerData);
