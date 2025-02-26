const puppeteer = require('puppeteer');

async function getM3u8FromTweet(tweetUrl) {
  console.log(`Attempting to extract m3u8 link from: ${tweetUrl}`);
  
  // Launch browser with required flags
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable request interception to monitor network requests
    await page.setRequestInterception(true);
    
    // Track m3u8 URLs found
    let m3u8Urls = [];
    
    // Listen for network requests
    page.on('request', request => {
      request.continue();
    });
    
    // Listen for responses to find m3u8 URLs
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('.m3u8')) {
        console.log(`Found m3u8 URL: ${url}`);
        m3u8Urls.push(url);
      }
    });
    
    // Navigate to the tweet
    console.log(`Navigating to tweet...`);
    await page.goto(tweetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for video to appear and interact with it to trigger playback
    console.log(`Looking for video element...`);
    await page.waitForSelector('video', { timeout: 30000 });
    
    // Click on the video to start playback
    await page.click('video');
    
    // Wait for a moment to capture network requests
    console.log(`Waiting for m3u8 requests...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // If no m3u8 URLs were found in the network requests, try to get them from media source
    if (m3u8Urls.length === 0) {
      console.log(`No m3u8 URLs found in network requests. Trying alternative method...`);
      
      // Execute JavaScript in the page context to get media sources
      const mediaUrls = await page.evaluate(() => {
        const videoElements = Array.from(document.querySelectorAll('video'));
        return videoElements.map(video => {
          if (video.src && video.src.includes('.m3u8')) {
            return video.src;
          }
          return null;
        }).filter(url => url !== null);
      });
      
      m3u8Urls = [...m3u8Urls, ...mediaUrls];
    }
    
    console.log(`Found ${m3u8Urls.length} m3u8 URLs`);
    
    return m3u8Urls;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Example usage
async function main() {
  const tweetUrl = 'https://x.com/naiivememe/status/1894133449562492984';
  const m3u8Urls = await getM3u8FromTweet(tweetUrl);
  
  if (m3u8Urls.length > 0) {
    console.log('Found m3u8 URLs:');
    m3u8Urls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
  } else {
    console.log('No m3u8 URLs found.');
  }
}

main().catch(console.error);