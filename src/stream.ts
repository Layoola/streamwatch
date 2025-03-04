const minimist = require("minimist");

import twitter from "./config/puppeteer";
import logger from "./logging/logger";
import { startScraping } from "./services/scraper";
import initializeDatabase from "./setup";

(async () => {
  console.log("🚀 Starting database initialization...");
  await initializeDatabase();
  console.log("✅ Database initialized successfully!");

  // Handle both minimist-style and direct argument passing
  const args = minimist(process.argv.slice(2));

  // Priority: Named arguments > Positional arguments
  const username = args.username || args.u || process.argv[2];
  const password = args.password || args.p || process.argv[3];
  const userToTrack = args.account || args.a || process.argv[4];

  if (!username || !password || !userToTrack) {
    logger.error(
      "Usage: node script.js --username=<your_username> --password=<your_password> --account=<account_to_track>"
    );
    logger.error(
      "Alternatively: node script.js <username> <password> <account_to_track>"
    );
    process.exit(1);
  }

  console.log("🚀 Starting Twitter scraper...");

  try {
    await twitter.initialize(username);
    const result = await twitter.login(username, password);

    if (result) {
      const { page } = result;
      await startScraping(page, userToTrack);
    } else {
      logger.error("❌ Login failed.");
      process.exit(1);
    }
  } catch (error) {
    logger.error("❌ An error occurred during scraping:", error);
    process.exit(1);
  }
})();