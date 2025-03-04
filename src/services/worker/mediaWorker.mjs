import path from "path";

async function convertM3u8ToBase64(url, outputBase64File) {
  const tempFile = `temp_${Date.now()}.mp4`;
  const outBase64File = `outputBase64_${Date.now()}.txt`;

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

    // Correct file deletion using `path.join`
    await unlink(path.join(__dirname, tempFile));
    await unlink(path.join(__dirname, outBase64File));

  } catch (error) {
    parentPort?.postMessage({ error: error.message });
  }
}

convertM3u8ToBase64(workerData.url, workerData.outputBase64File);
