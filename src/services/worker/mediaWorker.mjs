import { parentPort, workerData } from "worker_threads";
import { spawn } from "child_process";
import { readFile, unlink, writeFile } from "fs/promises";
import { access } from "fs";

async function convertM3u8ToBase64(url, outputBase64File) {
  const tempFile = `temp_${Date.now()}.mp4`;

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

          const outputBase64File = `outputBase64_${Date.now()}.txt`;

          await writeFile(outputBase64File, base64Data);
          parentPort?.postMessage({ base64Data, tempFile });
          resolve();
        } else {
          reject(new Error(`FFMPEG exited with code ${code}`));
        }
      });

      ffmpeg.on("error", reject);
    });

    // const videoBuffer = await readFile(tempFile);
    // const base64Data = videoBuffer.toString("base64");

    // await writeFile(outputBase64File, base64Data);

    // await unlink(tempFile);

    // parentPort?.postMessage({ base64Data, tempFile });
  } catch (error) {
    parentPort?.postMessage({ error: error.message });
  }
}

convertM3u8ToBase64(workerData.url, workerData.outputBase64File);
