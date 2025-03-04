import { parentPort, workerData } from "worker_threads";
import path from "path";
import { spawn } from "child_process";
import { readFile, unlink, writeFile } from "fs/promises";

async function convertM3u8ToBase64(url, outputBase64File) {
  const __dirname = path.resolve(path.dirname(""));
  const tempFile = path.join(__dirname, `temp_${Date.now()}.mp4`);
  const outBase64File = path.join(__dirname, `outputBase64_${Date.now()}.txt`);

  try {
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        url,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        tempFile,
      ]);

      let progressLine = "";
      ffmpeg.stderr.on("data", (data) => {
        const output = data.toString();
        if (output.includes("frame=") || output.includes("speed=")) {
          progressLine = output.split("\n")[0].trim();
          process.stdout.write(`\r${progressLine}`);
        }
      });

      ffmpeg.on("close", async (code) => {
        if (code === 0) {
          const videoBuffer = await readFile(tempFile);
          const base64Data = videoBuffer.toString("base64");

          await writeFile(outBase64File, base64Data);
          parentPort?.postMessage({ base64Data, tempFile });
          resolve();
        } else {
          reject(new Error(`FFMPEG exited with code ${code}`));
        }
      });

      ffmpeg.on("error", reject);
    });

    // await unlink(tempFile);
    await unlink(outBase64File);
  } catch (error) {
    parentPort?.postMessage({ error: error.message });
  }
}

// Ensure workerData is available before calling the function
if (workerData) {
  convertM3u8ToBase64(workerData.url, workerData.outputBase64File);
} else {
  parentPort?.postMessage({ error: "workerData is undefined" });
}
