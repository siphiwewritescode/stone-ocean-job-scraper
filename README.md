# Stone Ocean — SA Data Role Scraper

Stone Ocean is a automated agent that scrapes South African company career pages for **data roles** and emails the results. It runs on a schedule and only surfaces roles that match a specific set of data-focused keywords — so you're not sifting through hundreds of irrelevant listings.

## What it looks for

It filters for roles where the job title contains any of the following:

- Data (Data Analyst, Data Scientist, Data Engineer, etc.)
- BI / Business Intelligence
- Power BI / PowerBI
- ETL
- Reporting
- Analytics

Senior executive titles (Director, VP, Head of, Chief, Principal, etc.) are automatically excluded.

## Companies covered

**Tier 1 (priority)**
Nedbank, FNB, Discovery, Capitec, Vodacom, Absa, Standard Bank, Accenture SA

**Tier 2**
Santam, Momentum, Clicks, Shoprite, Woolworths, OUTsurance, MTN, Telkom, BCX, Dimension Data, Dis-Chem, Pick n Pay, Sanlam

## How it works

1. Launches a headless Chromium browser via Playwright
2. Visits each company's careers page directly (no third-party job boards)
3. Uses platform-aware selectors for Workday, SAP SuccessFactors, eRecruit, and Greenhouse ATS systems
4. Filters results to data roles only
5. Visits each matching job's detail page to check work arrangement (Remote / Hybrid / On-site)
6. Saves results to a daily JSON file and emails a summary

## Setup

```bash
npm install
```

Set your Gmail app password as an environment variable:

```bash
set GMAIL_APP_PASSWORD=your_app_password_here
```

## Running

```bash
npm run search
```

Or use `run_job_search.bat` / `run_hidden.vbs` to run it silently in the background on Windows.

## Output

Results are saved to `sa_data_jobs_YYYY-MM-DD.json` with the following fields per role:

```json
{
  "applied": false,
  "title": "Data Analyst",
  "company": "FNB",
  "location": "Johannesburg, South Africa",
  "work_arrangement": "Hybrid",
  "seniority": "Intermediate",
  "date_posted": "2026-03-24",
  "url": "https://...",
  "source": "Company Website",
  "description_snippet": "..."
}
```

Update `"applied": true` once you've applied to a role.

## Tech stack

- [Playwright](https://playwright.dev/) — headless browser automation
- [Nodemailer](https://nodemailer.com/) — email delivery
- Node.js
