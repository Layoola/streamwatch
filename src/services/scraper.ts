import { Page } from "puppeteer";
const fs = require("fs");

interface Tweet {
  text: string;
  username: string;
  timestamp: string;
  tweetId: string;
}

export class TwitterScraper {
  private page: Page;
  private lastKnownTweetId: string | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async getLatestTweet(username: string): Promise<Tweet | null> {
    try {
      await this.page.goto(`https://twitter.com/${username}`);
      await this.page.waitForSelector('article[data-testid="tweet"]');

      const latestTweet = await this.page.evaluate(() => {
        const tweetElement = document.querySelector(
          'article[data-testid="tweet"]'
        );
        if (!tweetElement) return null;

        // Get tweet ID from the link
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        const tweetId = tweetLink?.getAttribute("href")?.split("/status/")[1];

        const textElement = tweetElement.querySelector(
          'div[data-testid="tweetText"]'
        );
        const timeElement = tweetElement.querySelector("time");
        const statsElements = tweetElement.querySelectorAll(
          'div[data-testid$="-count"]'
        );

        return {
          text: textElement?.textContent || "",
          timestamp: timeElement?.getAttribute("datetime") || "",
          username:
            tweetElement.querySelector('div[data-testid="User-Name"]')
              ?.textContent || "",
          tweetId: tweetId || "",
        };
      });

      if (!latestTweet) {
        console.log("No tweets found");
        return null;
      }

      // Check if this is a new tweet
      if (this.lastKnownTweetId === latestTweet.tweetId) {
        console.log("No new tweets since last check");
        return null;
      }

      this.lastKnownTweetId = latestTweet.tweetId;
      console.log("✅ New tweet found!");
      return latestTweet;
    } catch (error) {
      console.error("Error scraping latest tweet:", error);
      return null;
    }
  }

  async saveToFile(data: any, filename: string): Promise<void> {
    try {
      fs.writeFileSync(filename, JSON.stringify(data, null, 2), "utf-8");
      console.log(`✅ Data saved to ${filename}`);
    } catch (error) {
      console.error("Error saving to file:", error);
    }
  }

  async monitorLatestTweets(
    username: string,
    checkInterval: number = 60000
  ): Promise<void> {
    console.log(`Started monitoring tweets for @${username}`);
    console.log(`Checking every ${checkInterval / 1000} seconds`);

    // Initial check
    await this.getLatestTweet(username);

    // Set up periodic checking
    setInterval(async () => {
      const newTweet = await this.getLatestTweet(username);
      if (newTweet) {
        await this.saveToFile(newTweet, `latest_tweet_${username}.json`);
        console.log("New tweet details:", newTweet);
      }
    }, checkInterval);
  }
}

// Example usage:
export const startScraping = async (page: Page) => {
  const scraper = new TwitterScraper(page);

  // Start monitoring a user's tweets
  //change to use cli input
  await scraper.monitorLatestTweets("olur0cks", 30000); // Check every 30 seconds
};
