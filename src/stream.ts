const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const twitterUsername = "your_username";
const twitterPassword = "your_password";
const accountToSearch = "elonmusk";
const tweetsSet = new Set();

(async () => {
    let browser:any;
    try {
        browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

        console.log("Opening Twitter...");
        await page.goto("https://twitter.com/login", { waitUntil: "networkidle2" });

        await page.waitForSelector('input[name="text"]', { visible: true });
        await page.type('input[name="text"]', twitterUsername);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);

        await page.waitForSelector('input[name="password"]', { visible: true });
        await page.type('input[name="password"]', twitterPassword);
        await page.keyboard.press("Enter");

        console.log("Logging in...");
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        await page.goto(`https://twitter.com/${accountToSearch}`, { waitUntil: "networkidle2" });

        console.log(`Monitoring tweets from @${accountToSearch}...`);

        async function scrapeTweets() {
            try {
                await page.reload({ waitUntil: "networkidle2" });

                const newTweets = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll("article")).map(tweet => {
                        const textElement = tweet.querySelector("div[lang]") as HTMLElement;
                        const timestampElement = tweet.querySelector("time") as HTMLElement;
                        const likeElement = tweet.querySelector('div[data-testid="like"]') as HTMLElement;
                        const retweetElement = tweet.querySelector('div[data-testid="retweet"]') as HTMLElement;
                        const replyElement = tweet.querySelector('div[data-testid="reply"]') as HTMLElement;
                        const mediaElements = tweet.querySelectorAll('img[alt="Image"]') as NodeListOf<HTMLImageElement>;
                        const tweetLinkElement = tweet.querySelector('a[href*="/status/"]') as HTMLAnchorElement;

                        return {
                            text: textElement ? textElement.innerText : null,
                            timestamp: timestampElement ? timestampElement.getAttribute("datetime") : null,
                            likes: likeElement ? likeElement.innerText || "0" : "0",
                            retweets: retweetElement ? retweetElement.innerText || "0" : "0",
                            replies: replyElement ? replyElement.innerText || "0" : "0",
                            media: mediaElements.length > 0 ? Array.from(mediaElements).map(img => img.src) : [],
                            tweetUrl: tweetLinkElement ? `https://twitter.com${tweetLinkElement.getAttribute("href")}` : null,
                        };
                    }).filter(tweet => tweet.text !== null);
                });

                newTweets.forEach((tweet: any) => {
                    if (!tweetsSet.has(tweet.tweetUrl)) {
                        tweetsSet.add(tweet.tweetUrl);
                        console.log("New Tweet Found:", tweet);
                        fs.appendFileSync("new_tweets.json", JSON.stringify(tweet, null, 2) + ",\n");
                    }
                });

                console.log(`Checked for new tweets at ${new Date().toLocaleTimeString()}`);
            } catch (error) {
                console.error("Error while scraping tweets:", error);
            }
        }

        setInterval(scrapeTweets, 60000);
    } catch (error) {
        console.error("Puppeteer script error:", error);
    } finally {
        process.on("SIGINT", async () => {
            console.log("Closing browser...");
            if (browser) await browser.close();
            process.exit();
        });
    }
})();
