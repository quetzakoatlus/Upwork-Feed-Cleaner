# 🧠 Upwork Insight Pro 

A powerful, all-in-one userscript that enhances the Upwork "Search" and "Job Feed" experience. It provides real-time client statistics, advanced filtering (by country, budget, proposals), and integrates Google Gemini AI to analyze job descriptions instantly.

![Version](https://img.shields.io/badge/version-13.13-blue) ![Status](https://img.shields.io/badge/status-active-green)

## ✨ Features

### 🚀 Unified Experience
- **One Script, Two Pages:** Works seamlessly on both the **Job Search** page (`/search/jobs/`) and your **Home Feed** (`/find-work/`).
- **Auto-Detection:** Automatically detects the page layout and applies the correct parsing logic.

### 🛡️ Advanced Filtering
Automatically collapses or hides jobs that don't match your criteria:
- **Location Filter:** Exclude clients from specific countries (e.g., "India, Pakistan, Kenya").
- **Keyword Filter:** Hide jobs with specific words in the title.
- **Proposal Filter:** Avoid saturated jobs (e.g., hide jobs with "50+" proposals).
- **Budget/Hourly protection:** Set minimum hourly rates and fixed-price budgets.
- **Payment Verification:** Option to hide clients with unverified payment methods on feed page.

### 📊 Insight Dashboard
Adds a statistics grid to every job card with color-coded "traffic light" indicators (Green/Orange/Red) based on your custom rules:
- **Hire Rate:** Client's historical hiring percentage.
- **Avg Hourly Pay:** What the client actually pays on average.
- **Interviewing:** How many people are currently being interviewed.
- **Bid Cost:** Calculates the real cost to apply (Connects × $0.15 + Tax).

### 🤖 AI Analysis (Gemini)
- **One-Click Analysis:** Click the 🧠 icon on any job to send the description to Google Gemini.
- **Custom Prompts:** Define your own persona (e.g., "Act as a Senior Python Developer...").
- **Free API:** Uses Google's free Gemini Flash API tier.

---

## 📥 Installation

1. **Install a Userscript Manager:**
   - [Tampermonkey](https://www.tampermonkey.net/) (Recommended)

2. **Install the Script:**
   - Click on the file **`Upwork-Insight-Unified.user.js`** in the file list above.
   - On the next page, click the **Raw** button (top right of the code).
   - Tampermonkey will ask to install it. Click **Install**.

3. **Get a Gemini API Key (Optional but Recommended):**
   - Go to [Google AI Studio](https://aistudio.google.com/).
   - Create a free API Key.
   - Open the script's settings panel on Upwork and paste the key into the **AI Configuration** section.

---

## ⚙️ Configuration

Once installed, look for the **Brain Icon (🧠)** in the bottom-right corner of Upwork. Click it to open the settings panel.

| Setting | Description |
| :--- | :--- |
| **Min. Hourly Rate** | Jobs below this rate will be auto-collapsed. |
| **Min. Budget** | Fixed-price jobs below this amount will be auto-collapsed. |
| **Proposal Filter** | Hides jobs with specific proposal counts (e.g., `20 to 50, 50+`). |
| **Exclude Countries** | Comma-separated list of countries to hide. |
| **Exclude Keywords** | Hides jobs containing specific words in the title. |
| **Verified Payment Only** | If checked, hides clients with unverified payment methods. |
| **Color Rules** | Set your own thresholds for what counts as "Good" (Green) or "Bad" (Red) stats. |

---

## ⚠️ Important: Upwork Terms of Service (TOS)

**Use this script at your own risk.** This tool fetches data from Upwork job pages to display statistics. While it includes "Stealth" timing to mimic human behavior, **automated scraping or data extraction** technically violates Upwork's Terms of Service.

---

## ⚠️ Compliance & Technical Disclaimer

**Please read this before using the script.**

This tool operates in two distinct ways. Understanding the difference is important for keeping your account safe.

### 🟢 The "Safe" Zone: Job Filtering
The filtering features (hiding jobs by Country, Keyword, Payment Verification, or Budget) are generally considered **safe**.

* **How it works:** The script simply reads the HTML that Upwork has *already loaded* into your browser. It then applies a CSS style (`display: none` or visual collapsing) to job cards you don't want to see.
* **Risk Level:** Extremely Low. This is identical to how ad-blockers or "dark mode" extensions work. You are just customizing how the page looks on your own computer.

### 🟠 The "Gray" Zone: Insight Data & AI
The "Insight" features (Client Hire Rate, Avg Hourly Pay, AI Analysis) exist in a **gray area** regarding Upwork's Terms of Service (specifically regarding "automated data collection").

* **How it works:** The data for "Hire Rate" and "Avg Pay" is *not* present on the search page. To show it to you, the script performs a background `fetch()` request.
* **What this means:** When you click "Insights" or browse a feed with this enabled, your browser sends a hidden request to Upwork's servers to download the full job post (as if you clicked the link), reads the stats, and then displays them on the card.
* **The Risk:** If you load hundreds of job insights in a few seconds, Upwork's security systems might interpret this traffic pattern as a **bot** or **scraper** extracting data, which can trigger a temporary block or account review.

### 🔧 Technical Details & Mitigation
To protect your account, this script includes a **Stealth Timing System**:

1.  **Randomized Delays:** The script will never fetch data instantly. It waits a random interval (default: 2–4 seconds) between requests to mimic human browsing speed.
2.  **On-Demand fetching:** By default, "Search" results do not auto-fetch. You must click the "Insight" button manually, which keeps your traffic organic.
3.  **Cloudflare Detection:** If Upwork presents a "Verify you are human" challenge, the script detects the specific 403/503 error headers, pauses all activity, and prompts you to verify manually.

**Recommendation:**
* Treat the "Insight" button like a manual click. Do not try to modify the code to fetch 50 jobs at once.
* Use the default `SCAN_MIN_MS` timings provided in the script.

## 📝 License

This project is for educational purposes only. The author is not responsible for any account actions taken by Upwork.
