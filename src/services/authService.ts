import twitter from "../config/puppeteer";
const minimist = require("minimist");

export const loginToTwitter = async () => {
  const args = minimist(process.argv.slice(2));
  const username = args.username || args.u;
  const password = args.password || args.p;

  if (!username || !password) {
    console.error(
      "Usage: node script.js --username=<your_username> --password=<your_password>"
    );
    process.exit(1);
  }

  await twitter.initialize();
  await twitter.login(username, password);
};
