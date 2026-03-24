/**
 * LinkedIn Session Saver
 * Run this ONCE manually to log into LinkedIn and save your session.
 * Usage: node save_linkedin_session.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.resolve(__dirname, 'linkedin_session.json');

(async () => {
  console.log('\n========================================');
  console.log('   Stone Ocean - Session Setup');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'en-ZA',
    timezoneId: 'Africa/Johannesburg',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login');

  console.log('A browser window has opened.');
  console.log('Please log into LinkedIn manually.');
  console.log('Once you see your LinkedIn feed, press Enter here...\n');

  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  await context.storageState({ path: SESSION_FILE });
  console.log(`Session saved to: ${SESSION_FILE}`);
  await browser.close();
  process.exit(0);
})();
