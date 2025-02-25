import * as fs from "fs";
import axios from "axios";
import * as puppeteer from "puppeteer";

const downloadFolder = "./downloads";
if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

const downloadVideo = async (videoUrl: string, filePath: string) => {
  const response = await axios({
    url: videoUrl,
    method: "GET",
    responseType: "stream",
  });
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  return new Promise<void>((resolve, reject) => {
    writer.on("finish", () => resolve());
    writer.on("error", reject);
  });
};

const videoToBase64 = (filePath: string) => {
  const videoData = fs.readFileSync(filePath);
  return videoData.toString("base64");
};

export const scrapeAndDownload = async (tweetUrl: string) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Open Twitter downloader
  await page.goto("https://ssstwitter.com", {
    waitUntil: "networkidle2",
  });

  // Enter the tweet URL in the downloader
  await page.type("#main_page_text", tweetUrl);
  await page.click("#submit");

  // Wait for result section
  await page.waitForSelector(".result_overlay");

  // Get the first download link
  const videoUrl = await page.evaluate(() => {
    const downloadBtn = document.querySelector(
      ".result_overlay .download_link"
    ) as HTMLAnchorElement;
    return downloadBtn ? downloadBtn.href : null;
  });

  if (!videoUrl) {
    console.error("❌ No download link found!");
    await browser.close();
    return null;
  }

  console.log(`✅ Video URL found: ${videoUrl}`);

  // Set file path & download video
  const filePath = `${downloadFolder}/video.mp4`;
  await downloadVideo(videoUrl, filePath);

  console.log("✅ Video downloaded successfully!");

  // Convert to Base64
  const base64Data = videoToBase64(filePath);
  console.log("✅ Video converted to Base64!");

  await browser.close();
  return base64Data;
};

// // Example Usage
// scrapeAndDownload("https://twitter.com/Eminem/status/943590594491772928")
//     .then((base64) => console.log("🎉 Base64 Result:", base64.substring(0, 100) + "..."))
//     .catch(console.error);
