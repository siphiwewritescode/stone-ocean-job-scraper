/**
 * Rapido - Stone Ocean v2
 */

const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];
const OUTPUT_FILE = path.resolve(__dirname, `sa_data_jobs_${TODAY}.json`);
const ERROR_LOG = path.resolve(__dirname, 'session_errors.log');
const PROGRESS_LOG = path.resolve(__dirname, 'search_progress.log');

function logProgress(msg) {
  const timestamp = new Date().toLocaleTimeString('en-ZA');
  const line = `[${timestamp}] ${msg}`;
  fs.appendFileSync(PROGRESS_LOG, line + '\n');
  // Also write current status to a single-line file for the tray app
  fs.writeFileSync(path.resolve(__dirname, 'status.txt'), msg);
}


const EXCLUDE_TITLES_REGEX = /\b(executive|director|vp|vice president|c-level|cto|cfo|cio|cdo|chief|head of|department lead|principal|staff)\b/i;

const EXCLUDE_COMPANY = /intrade\s*africa/i;

const SENIORITY_MAP = [
  { label: 'Junior', min: 0, max: 2 },
  { label: 'Intermediate', min: 2, max: 5 },
  { label: 'Mid-Senior', min: 5, max: 8 }
];

// Priority companies are listed first — scraped before LinkedIn runs
const COMPANY_CAREER_PAGES = [
  // ── Tier 1: Priority companies ────────────────────────────────────────────────
  { name: 'Nedbank',        platform: 'successfactors', url: 'https://career2.successfactors.eu/careers?company=C0001228596P' },
  { name: 'FNB',            platform: 'workday',        url: 'https://firstrand.wd3.myworkdayjobs.com/FRB' },
  { name: 'Discovery',      platform: 'successfactors', url: 'https://career2.successfactors.eu/careers?company=discoveryhP' },
  { name: 'Capitec',        platform: 'successfactors', url: 'https://career2.successfactors.eu/career?company=capitecban' },
  { name: 'Vodacom',        platform: 'workday',        url: 'https://vodafone.wd3.myworkdayjobs.com/vodafone_careers' },
  { name: 'Absa',           platform: 'workday',        url: 'https://absa.wd3.myworkdayjobs.com/en-US/ABSAcareersite' },
  { name: 'Standard Bank',  platform: 'generic',        url: 'https://careers.standardbank.com/Search' },
  { name: 'Accenture SA',   platform: 'workday',        url: 'https://accenture.wd103.myworkdayjobs.com/AccentureCareers' },
  // ── Tier 2: Secondary companies ───────────────────────────────────────────────
  { name: 'Santam',         platform: 'successfactors', url: 'https://career5.successfactors.eu/careers?company=sanlamlifeP2' },
  { name: 'Momentum',       platform: 'erecruit',       url: 'https://momentum.erecruit.co/candidateapp/Jobs/Browse.aspx' },
  { name: 'Clicks',         platform: 'erecruit',       url: 'https://clicks.erecruit.co/candidateapp/Jobs/Browse.aspx' },
  { name: 'Shoprite',       platform: 'erecruit',       url: 'https://shoprite.erecruit.co/candidateapp/Jobs/Browse.aspx' },
  { name: 'Woolworths',     platform: 'erecruit',       url: 'https://woolworths.erecruit.co/candidateapp/Jobs/Browse.aspx' },
  { name: 'OUTsurance',     platform: 'generic',        url: 'https://www.outsurance.co.za/careers/' },
  { name: 'MTN',            platform: 'generic',        url: 'https://ehle.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions' },
  { name: 'Telkom',         platform: 'generic',        url: 'https://www.telkom.co.za/about/careers/' },
  { name: 'BCX',                    platform: 'generic',     url: 'https://www.bcx.co.za/careers/' },
  { name: 'Dimension Data',         platform: 'generic',     url: 'https://careers.dimensiondata.com/global/en/search-results' },
  { name: 'Dis-Chem',               platform: 'greenhouse',  url: 'https://boards.greenhouse.io/dischem' },
  { name: 'Pick n Pay',             platform: 'generic',     url: 'https://www.pnpcareers.co.za' },
  { name: 'Sanlam',         platform: 'generic',        url: 'https://www.sanlamonline.co.za/careers/job-listing' },
];

// ─── HELPERS ─────────────────────────────────────────────────────

function logError(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(ERROR_LOG, `[${timestamp}] ${msg}\n`);
}

function inferSeniority(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  if (/\bjunior\b/.test(text) || /\bgraduate\b/.test(text) || /\bintern\b/.test(text)) return 'Junior';
  if (/\bsenior\b/.test(text) || /\blead\b/.test(text)) return 'Mid-Senior';
  if (/\bmid[\s-]?senior\b/.test(text)) return 'Mid-Senior';
  if (/\bintermediate\b/.test(text) || /\bmid[\s-]?level\b/.test(text)) return 'Intermediate';

  // Try to infer from years of experience
  const yearsMatch = text.match(/(\d+)\s*(?:\+\s*)?(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1]);
    if (years <= 2) return 'Junior';
    if (years <= 5) return 'Intermediate';
    if (years <= 8) return 'Mid-Senior';
    return null; // 8+ years, exclude
  }

  return 'Intermediate'; // default assumption
}

function isDataRole(title) {
  return /\b(data|bi\b|business intelligence|power bi|powerbi|etl|reporting|analytics)\b/i.test(title);
}


function shouldExclude(title, company) {
  if (EXCLUDE_TITLES_REGEX.test(title)) return true;
  if (EXCLUDE_COMPANY.test(company)) return true;
  return false;
}

async function removeBanners(page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll(
        '[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="banner"], [class*="popup"], [class*="modal"], [class*="overlay"], [class*="gdpr"], [id*="gdpr"]'
      ).forEach(el => el.remove());
    });
  } catch (e) { /* silent */ }
}

// ─── JSON FILE MANAGEMENT ────────────────────────────────────────

function loadExistingJobs() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      return data;
    } catch (e) {
      logError(`Failed to parse existing JSON file: ${e.message}`);
    }
  }
  return null;
}

function saveJobs(existingData, newJobs) {
  const now = new Date().toISOString();

  if (existingData) {
    const existingUrls = new Set(existingData.jobs.map(j => j.url));
    const uniqueNewJobs = newJobs.filter(j => !existingUrls.has(j.url));

    existingData.jobs.push(...uniqueNewJobs);
    existingData.total_jobs = existingData.jobs.length;
    existingData.last_updated = now;

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2), 'utf-8');
    return uniqueNewJobs;
  } else {
    const data = {
      generated_at: now,
      last_updated: now,
      date_searched: TODAY,
      total_jobs: newJobs.length,
      jobs: newJobs
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return newJobs;
  }
}

// ─── COMPANY CAREER PAGE SCRAPER ─────────────────────────────────

async function scrapeCompanyPages(browser) {
  const jobs = [];

  const context = await browser.newContext({
    locale: 'en-ZA',
    timezoneId: 'Africa/Johannesburg',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    geolocation: { latitude: -25.7479, longitude: 28.2293 }
  });

  const page = await context.newPage();

  let companyCount = 0;
  for (const company of COMPANY_CAREER_PAGES) {
    companyCount++;
    try {
      logProgress(`Company [${companyCount}/${COMPANY_CAREER_PAGES.length}]: ${company.name} (${company.platform})`);
      await page.goto(company.url, { timeout: 25000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await removeBanners(page);

      // Check page loaded
      const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
      if (!pageText || pageText.length < 50) {
        logError(`${company.name}: Page appears empty or blocked`);
        continue;
      }

      // Search for data roles (best-effort — not all ATS support this)
      await trySearch(page, 'data');
      await page.waitForTimeout(2000);

      // Extract job links using platform-aware selectors
      const foundJobs = await extractJobLinks(page, company);
      logProgress(`  ${company.name}: ${foundJobs.length} data role(s) found`);

      // Visit each job's detail page to confirm it's not explicitly on-site
      for (const job of foundJobs.slice(0, 20)) {
        if (shouldExclude(job.title, job.company)) continue;

        let workArrangement = 'Hybrid'; // SA corporate default
        let location = 'Gauteng, South Africa';
        let snippet = '';

        try {
          await page.goto(job.url, { timeout: 15000 });
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          await removeBanners(page);

          const details = await page.evaluate(() => {
            const text = document.body?.innerText || '';
            const lower = text.toLowerCase();
            const isHybrid  = /\bhybrid\b/i.test(lower);
            const isRemote  = /\bremote\b/i.test(lower) && !isHybrid;
            // Only skip if the job is explicitly on-site AND not hybrid
            const isOnSite  = /\b(on[\s-]?site|in[\s-]?office|office[\s-]?based)\b/i.test(lower) && !isHybrid;
            const locMatch  = text.match(/(pretoria|tshwane|johannesburg|joburg|jhb|sandton|midrand|rosebank|centurion|gauteng|cape town|durban)/i);
            const descEl    = document.querySelector('[class*="description"], [class*="details"], article, main, [class*="content"]');
            const snippet   = descEl?.textContent?.trim()?.substring(0, 200) || text.substring(0, 200);
            return { isHybrid, isRemote, isOnSite, location: locMatch?.[0] || '', snippet };
          });

          // Skip only if confirmed on-site (no hybrid)
          if (details.isOnSite) continue;

          workArrangement = details.isHybrid ? 'Hybrid' : details.isRemote ? 'Remote' : 'Hybrid';
          if (details.location) location = `${details.location}, South Africa`;
          snippet = details.snippet;

        } catch (e) {
          logError(`${company.name} detail error for "${job.title}": ${e.message}`);
          // Still include — title alone is enough to know it's a data role
        }

        const seniority = inferSeniority(job.title, snippet);
        if (!seniority) continue; // 8+ years experience required — skip

        jobs.push({
          title: job.title,
          company: job.company,
          location,
          work_arrangement: workArrangement,
          seniority,
          date_posted: TODAY,
          url: job.url,
          source: 'Company Website',
          description_snippet: snippet
        });
      }

    } catch (e) {
      logError(`${company.name} career page error: ${e.message}`);
    }
  }

  await context.close();
  return jobs;
}

// ─── ATS-AWARE JOB LINK EXTRACTOR ────────────────────────────────
// Uses platform-specific selectors first, then falls back to generic link scraping

async function extractJobLinks(page, company) {
  return await page.evaluate(({ companyName, platform }) => {
    const results = [];
    const seen    = new Set();
    const DATA_RE = /(data|bi\b|business intelligence|power bi|powerbi|etl|reporting|analytics)/i;

    function add(title, url) {
      title = (title || '').replace(/\s+/g, ' ').trim();
      url   = (url   || '').split('?')[0]; // strip query params for dedup
      if (!title || !url || seen.has(url)) return;
      if (title.length < 4 || title.length > 200) return;
      if (!DATA_RE.test(title)) return;
      seen.add(url);
      results.push({ title, url, company: companyName });
    }

    // ── Workday ──────────────────────────────────────────────────
    if (platform === 'workday') {
      document.querySelectorAll('[data-automation-id="jobTitle"]').forEach(el => {
        const link = el.tagName === 'A' ? el : el.closest('a') || el.querySelector('a');
        add(el.textContent, link?.href);
      });
      document.querySelectorAll('a[href*="/job/"]').forEach(el => add(el.textContent, el.href));
    }

    // ── SAP SuccessFactors ────────────────────────────────────────
    if (platform === 'successfactors') {
      document.querySelectorAll([
        'a[href*="jobId"]',
        'a[href*="job_id"]',
        'a[class*="jobTitle"]',
        '[class*="job-title"] a',
        '.sfds-c-job-title a',
        '[class*="jobCard"] a',
        '[class*="job-card"] a',
        'a[href*="/careers/"]',
      ].join(',')).forEach(el => add(el.textContent, el.href));
    }

    // ── eRecruit ─────────────────────────────────────────────────
    if (platform === 'erecruit') {
      document.querySelectorAll([
        '.jobTitle a',
        'a[href*="/Jobs/Apply/"]',
        'a[href*="Job/Apply"]',
        'td.column1 a',
        'a[href*="/candidateapp/"]',
      ].join(',')).forEach(el => add(el.textContent, el.href));
    }

    // ── Greenhouse ────────────────────────────────────────────────
    if (platform === 'greenhouse') {
      document.querySelectorAll([
        '.opening a',
        'a[href*="/jobs/"]',
        '[class*="job-post"] a',
        'section.level-0 a',
      ].join(',')).forEach(el => add(el.textContent, el.href));
    }

    // ── Generic fallback (runs for all platforms) ─────────────────
    [
      'a[href*="job"], a[href*="vacancy"], a[href*="position"], a[href*="requisition"]',
      '[class*="job-list"] a, [class*="vacancy"] a, [class*="career-list"] a',
      '[class*="search-result"] a, [class*="searchResult"] a',
      '.job-title a, .vacancy-title a, h3 a, h4 a',
      '[data-job] a, [data-vacancy] a',
    ].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => add(el.textContent, el.href));
    });

    return results;
  }, { companyName: company.name, platform: company.platform || 'generic' });
}

async function trySearch(page, query) {
  try {
    const searchSelectors = [
      'input[type="search"]', 'input[type="text"]',
      'input[placeholder*="search" i]', 'input[placeholder*="keyword" i]',
      'input[name*="search" i]', 'input[name*="keyword" i]',
      'input[id*="search" i]', 'input[aria-label*="search" i]',
      '#keyword', '#search'
    ];

    for (const selector of searchSelectors) {
      const input = await page.$(selector);
      if (input) {
        await input.fill(query);
        // Try to submit
        await input.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        return true;
      }
    }
  } catch (e) { /* silent */ }
  return false;
}

// ─── WORKDAY SCRAPER ──────────────────────────────────────────────

async function scrapeWorkdaySite(page, company, baseUrl) {
  const jobs = [];
  try {
    // Workday sites have a specific pattern
    await page.goto(baseUrl, { timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await removeBanners(page);

    // Search for data roles
    const searchInput = await page.$('input[data-automation-id="searchBox"], input[aria-label*="Search"]');
    if (searchInput) {
      await searchInput.fill('data');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }

    // Extract Workday job cards
    const foundJobs = await page.evaluate((companyName) => {
      const results = [];
      const cards = document.querySelectorAll('[data-automation-id="jobTitle"], a[href*="/job/"]');
      cards.forEach(card => {
        const title = card.textContent?.trim() || '';
        const url = card.href || card.closest('a')?.href || '';
        if (title && /(data|bi\b|power bi|etl|reporting|analytics)/i.test(title)) {
          results.push({ title, url, company: companyName });
        }
      });
      return results;
    }, company);

    return foundJobs;
  } catch (e) {
    logError(`Workday scrape error for ${company}: ${e.message}`);
    return [];
  }
}

// ─── EMAIL SENDER ────────────────────────────────────────────────

async function sendEmail(newJobs, totalJobs) {
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!appPassword) {
    logError('GMAIL_APP_PASSWORD environment variable not set. Skipping email.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'lindangwaluko6@gmail.com',
      pass: appPassword
    }
  });

  const jobRows = newJobs.map((job, i) => `
    <tr style="border-bottom:1px solid #ddd;">
      <td style="padding:8px; text-align:center;">${i + 1}</td>
      <td style="padding:8px;">${escapeHtml(job.title)}</td>
      <td style="padding:8px;">${escapeHtml(job.company)}</td>
      <td style="padding:8px;">${escapeHtml(job.location)}</td>
      <td style="padding:8px;">${job.work_arrangement}</td>
      <td style="padding:8px;">${job.seniority}</td>
      <td style="padding:8px; text-align:center;"><a href="${job.url}" style="color:#4A90D9;">Apply</a></td>
    </tr>
  `).join('');

  const html = `
    <h2>SA Data Jobs &ndash; ${TODAY}</h2>
    <p>Hi Linda,</p>
    <p><strong>${newJobs.length} new job(s)</strong> were found in this hourly run. Here they are:</p>

    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif; font-size:14px;">
      <thead style="background-color:#4A90D9; color:white;">
        <tr>
          <th style="padding:8px;">#</th>
          <th style="padding:8px;">Job Title</th>
          <th style="padding:8px;">Company</th>
          <th style="padding:8px;">Location</th>
          <th style="padding:8px;">Arrangement</th>
          <th style="padding:8px;">Seniority</th>
          <th style="padding:8px;">Link</th>
        </tr>
      </thead>
      <tbody>
        ${jobRows}
      </tbody>
    </table>

    <hr style="margin:20px 0;">
    <h3 style="color:#333;">Today's Full Job List (including previously sent jobs)</h3>
    <p>The attached JSON file contains all ${totalJobs} jobs found today.</p>
  `;

  const mailOptions = {
    from: 'lindangwaluko6@gmail.com',
    to: 'lindangwaluko6@gmail.com',
    subject: `SA Data Jobs – ${TODAY} | ${newJobs.length} new job(s) found (Total today: ${totalJobs})`,
    html: html,
    attachments: [
      {
        filename: `sa_data_jobs_${TODAY}.json`,
        path: OUTPUT_FILE
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (e) {
    logError(`Email send failed: ${e.message}`);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── MAIN ────────────────────────────────────────────────────────

(async () => {
  // Clear progress log for this run
  fs.writeFileSync(PROGRESS_LOG, '');
  logProgress('Stone Ocean started...');

  let browser;
  try {
    logProgress('Launching headless browser...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-permissions-dialog',
        '--allow-running-insecure-content',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    // Load existing data
    const existingData = loadExistingJobs();
    logProgress(existingData ? `Loaded ${existingData.total_jobs} existing jobs from today` : 'No existing jobs file for today - starting fresh');

    // ── Scrape all company career pages ──────────────────────────────────────
    logProgress('Starting company career page scrapers...');
    const companyJobs = await scrapeCompanyPages(browser);
    logProgress(`Company pages complete: ${companyJobs.length} job(s) found`);

    const allNewJobs = [...companyJobs];
    const seenUrls = new Set();
    const dedupedJobs = [];
    for (const job of allNewJobs) {
      if (!job.url || seenUrls.has(job.url)) continue;
      seenUrls.add(job.url);
      dedupedJobs.push(job);
    }

    logProgress(`${dedupedJobs.length} unique jobs after deduplication`);

    // Save to JSON (append-only)
    const actuallyNewJobs = saveJobs(existingData, dedupedJobs);
    logProgress(`${actuallyNewJobs.length} NEW jobs added to JSON file`);

    // Send email only if new jobs were found
    if (actuallyNewJobs.length > 0) {
      logProgress(`Sending email with ${actuallyNewJobs.length} new jobs...`);
      const updatedData = loadExistingJobs();
      const totalJobs = updatedData ? updatedData.total_jobs : actuallyNewJobs.length;
      await sendEmail(actuallyNewJobs, totalJobs);
      logProgress('Email sent successfully!');
    } else {
      logProgress('No new jobs found this run - skipping email');
    }

    await browser.close();
    logProgress('DONE - Stone Ocean complete!');
  } catch (e) {
    logError(`Fatal error: ${e.message}`);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
})();
