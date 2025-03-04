const minimist = require("minimist");

import twitter from "./config/puppeteer";
import logger from "./logging/logger";
import { startScraping } from "./services/scraper";
import initializeDatabase from "./setup";
import * as readline from "readline";

(async () => {
  console.log("🚀 Starting database initialization...");
  await initializeDatabase();
  console.log("✅ Database initialized successfully!");
  const args = minimist(process.argv.slice(2));
  const username = args.username || args.u;
  const password = args.password || args.p;

  if (!username || !password) {
    logger.error(
      "Usage: node script.js --username=<your_username> --password=<your_password>"
    );
    // process.exit(1);
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("🚀 Starting Twitter scraper...");
  rl.question("Enter the Twitter userToTrack to monitor: ", async (input) => {
    const userToTrack = input.trim();
    if (!userToTrack) {
      logger.error("❌ userToTrack cannot be empty.");
      // process.exit(1);
    }

    await twitter.initialize();
    const result = await twitter.login(username, password);

    if (result) {
      const { page } = result;
      await startScraping(page, userToTrack);
      rl.close();
    }
  });
})();
