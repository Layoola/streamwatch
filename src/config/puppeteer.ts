export const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE_URL = "https://twitter.com/";
const LOGIN_URL = "https://twitter.com/login";

let browser: any = null;
let page: any = null;

const USER_DATA_DIR = "./user_data";

const twitter = {
  initialize: async () => {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: {
        width: 1440,
        height: 1080,
      },
      userDataDir: "./user_data",
    });
    page = await browser.newPage();
    await page.goto(BASE_URL);
    await new Promise((r) => setTimeout(r, 2000));
  },
  login: async (username: string, password: string) => {
    const isSessionAvailable = fs.existsSync(USER_DATA_DIR);

    if (isSessionAvailable) {
      console.log("🔄 Using existing session, skipping login.");
      return { browser, page };
    }
    console.log("🔑 No session found. Logging in...");

    await new Promise((r) => setTimeout(r, 3000));

    await page.goto(LOGIN_URL);
    await page.waitForSelector('input[name="text"]', { visible: true });
    await page.type('input[name="text"]', username);
    console.log("Typing username...");
    await new Promise((r) => setTimeout(r, 2000));

    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 2000));
    // await page.waitForTimeout(2000);

    await page.waitForSelector('input[name="password"]', { visible: true });
    await page.type('input[name="password"]', password);
    console.log("Typing password...");
    await new Promise((r) => setTimeout(r, 2000));
    await page.keyboard.press("Enter");

    console.log("Logging in...");

    await new Promise((r) => setTimeout(r, 3000));
    try {
      // ✅ Check for successful login
      await page.waitForSelector('a[aria-label="Profile"]', { timeout: 5000 });
      console.log("✅ Login successful!");
      return { browser, page };
    } catch (error) {
      // ❌ Check for login failure
      const errorText = await page.evaluate(() => {
        const errorElement = document.querySelector(
          "div[role='alert']"
        ) as HTMLElement;
        return errorElement ? errorElement.innerText : null;
      });

      console.log(
        "❌ Login failed:",
        errorText ||
          "Unknown error. Check your parameters and confirm that you're not being rate-limited."
      );
      return false;
    }
  },
};

export default twitter;
