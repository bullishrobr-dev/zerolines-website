# Zero Lines — Agent Context

> **Last updated**: 2026-05-28  
> **Current branch**: `main`  
> **Working tree**: clean (no uncommitted changes)  
> **Recent commit**: `b628794` — fix: comprehensive audit implementation — P0 & P1 fixes

---

## Project Overview

Zero Lines is a **clinical-luxury skincare brand** based in Gibraltar. This is the public marketing website — a multi-page static HTML site hosted on **Netlify**.

- **Domain**: zero-lines.com (production)
- **Local path**: `/Users/metabt/Desktop/ZLweb`
- **No build step** — this is hand-written static HTML/CSS/JS
- **No framework** — vanilla JavaScript, custom CSS, no React/Vue/etc on the frontend
- **Service Worker** — added for asset caching (`service-worker.js`)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Hosting | Netlify (see `.netlify/`, `_redirects`) |
| Backend | Cloudflare Worker (AI quiz analyzer — see `api/zero-lines-quiz-worker.js`) |
| Testing | Playwright (`audit_screenshots.js`, `audit_screenshots2.js`) |
| Images | JPG + WebP dual-format |
| Analytics | Google Analytics 4 placeholder (`G-XXXXXXXXXX`) — **NOT configured** |

---

## Project Structure

```
/
├── index.html                    # Homepage (SPA hash-router workaround inside)
├── 404.html                      # Netlify 404 page
├── _redirects                    # Netlify redirect rules
├── accessibility.html
├── cookies.html
├── AGENTS.md                     # ← You are here
│
├── products/
│   ├── index.html                # Product listing
│   ├── day-cream/
│   ├── night-cream/
│   ├── peeling-gel/
│   ├── serum/
│   ├── syringe/
│   └── syringe-refill/
│
├── blog/                         # ~30 articles, categorized
│   ├── blog.css
│   ├── category-*.html           # Category index pages
│   └── *.html                    # Individual posts
│
├── contact/
│   └── index.html                # Recently redesigned (May 2026)
├── protocol/
│   └── index.html
├── science/
│   └── index.html
├── story/
│   └── index.html
├── testimonials/
│   └── index.html
│
├── api/
│   └── zero-lines-quiz-worker.js # Cloudflare Worker source (GPT-4o via OpenRouter)
│                                 #   NOTE: Deployed separately to Cloudflare, not Netlify Functions
│
├── assets/                       # Product photos, lifestyle images (~120 files)
│   ├── *.jpg
│   └── *.webp
│
└── audit_screenshots.js          # Playwright scripts for visual QA
    audit_screenshots2.js
```

---

## Critical Architecture Notes

### 1. Hash-Router SPA Workaround (`index.html`)
The site uses a **hash-based router** (`/#/products/...`) with a hard-reload hack to ensure product pages load correctly:
- A `<script>` in `<head>` intercepts `pushState`/`replaceState`/`popstate`
- When navigation to `#/products/*` is detected, it forces a `window.location.reload(true)`
- Uses `sessionStorage` flag to prevent infinite loops
- **Do NOT remove this script** unless migrating to a real router or clean URLs

### 2. Product Navigation Injection
Product pages share a navigation component that is **injected via JavaScript** (not server-rendered). There have been multiple rounds of fixes for timing/race conditions:
- Uses polling with retry logic (800ms delay, 100 retries at 100ms)
- A `MutationObserver` detects when the injection container appears
- See git history: commits `df2ecc8` through `89b36ac` for the evolution

### 3. AI Face Analyzer Quiz
- Frontend quiz collects: age, gender, skin type, climate, concerns, routine, sleep, duration, treatments, lifestyle + a face photo
- Submits to the Cloudflare Worker (`api/zero-lines-quiz-worker.js`)
- Worker calls **GPT-4o via OpenRouter** to generate a personalized dermatology report
- The worker is **NOT auto-deployed** by Netlify — must be copied manually to Cloudflare dashboard

### 4. Clean URLs Migration
Previous work (commit `40c642c`) migrated from hash-based SPA URLs to clean URLs for SEO. The `_redirects` file and internal links should now use clean paths.

---

## Known Issues / Technical Debt

| Issue | Status | Notes |
|-------|--------|-------|
| GA4 ID is placeholder | **OPEN** | `G-XXXXXXXXXX` appears in `index.html`. Replace with real Measurement ID when ready |
| OpenRouter API key | **OPEN** | Stored in Cloudflare Worker secrets (not in repo). Rotate if needed |
| WhatsApp number | **FIXED** | Currently `+35054005198` (was `+35054000118` — fixed in commit `8197cc8`) |
| Animation jank | **IMPROVED** | Multiple rounds of fixes (commits `24cb863`, `a08c83d`). May still occur on low-end devices |
| Product nav injection timing | **STABLE** | Last fix in `211e0e9` / `89b36ac`. Monitor if new pages are added |
| No README.md | **OPEN** | This AGENTS.md is the only project documentation |

---

## Recent Work History (May 2026)

1. **Design Audit Implementation** — 4 expert audit reports were implemented across the site (commit `f147c40`)
2. **Contact Page Redesign** — fully rebuilt (commit `a08c83d`)
3. **Protocol Animations Fix** — removed broken page transitions, fixed scroll animations (commit `a08c83d`)
4. **SEO Optimization Pass** — structured data (Schema.org), WebP images, meta tags, blog SEO, waitlist form (commit `4d0c493`)
5. **Waitlist Button Position** — moved to bottom-left to avoid conflict with WhatsApp widget (commit `c6f0b9e`)

---

## How to Test

```bash
# Install dependencies (Playwright)
npm install

# Run visual audit screenshots
node audit_screenshots.js
node audit_screenshots2.js
```

For local preview, serve the root directory with any static server:
```bash
npx serve .
# or
python3 -m http.server 8000
```

---

## Deployment

- **Frontend**: Auto-deploys via Netlify Git integration (push to `main`)
- **Worker**: Manual copy-paste to [Cloudflare Workers dashboard](https://dash.cloudflare.com/) — see comments in `api/zero-lines-quiz-worker.js`

---

## Contact / Context

- **Owner**: Roberto Koz (`robertokoz@icloud.com`)
- **WhatsApp Business**: `+35054005198`
- **Brand positioning**: "Skin Longevity House" — clinical-grade botanical science from Pyrenean mineral springs
- **Product range**: 6 SKUs (Peeling Gel, Collagen Syringe, Serum, Day Cream, Night Cream, Syringe Refill)

---

> **For future agents**: Before making changes, check `git log --oneline -10` to see if work has continued since this file was written. Update this file when making significant architectural or design changes.
