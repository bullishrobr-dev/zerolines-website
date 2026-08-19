# Zero Lines Website — Accessibility & SEO Audit Report

**Date:** 2026-05-28  
**Scope:** Root SPA (`index.html`), product shells (`/products/*`), top-level pages (`/contact/`, `/science/`, `/story/`, `/testimonials/`, `/protocol/`), blog system (`/blog/` + `/blog/*.html`), CSS (`assets/index-BELDyRU9.css`, `blog/blog.css`), JS bundle (`assets/index-CdnbiGbM.js`)

---

## Severity Legend

- **🔴 Critical** — Blocks users or search engines; fix immediately
- **🟠 High** — Significant barrier to accessibility or SEO; fix before launch
- **🟡 Medium** — Should be addressed for best practices
- **🟢 Low** — Nice-to-have improvements

---

## 1. SEO Audit

### 🔴 Critical

#### 1.1 SPA Hash Routing — Search engines cannot index deep pages
- **Files:** All pages
- **Issue:** The site uses `window.location.hash = '#/route'` for routing. Search engines (Google included) generally do NOT treat hash-fragment URLs as separate pages.
- **Impact:** `/contact/`, `/science/`, `/products/:slug` etc. will not be independently indexed. The only indexed page will effectively be `/`.
- **Evidence:** 
  ```js
  // products/*/index.html
  window.location.hash = '#/products/day-cream';
  ```
  ```js
  // contact/index.html
  window.location.hash = '#/contact';
  ```
- **Fix:** Migrate to History API routing (`/contact`, `/products/day-cream`) with proper server-side rewrite rules (e.g., Netlify `_redirects` SPA fallback). Alternatively, ensure each static shell contains meaningful semantic content and unique `<title>`/meta tags so crawlers see real content even before JS runs.

#### 1.2 Product page shells are completely thin
- **Files:** `products/day-cream/index.html`, `products/night-cream/index.html`, `products/peeling-gel/index.html`, `products/serum/index.html`, `products/syringe/index.html`, `products/syringe-refill/index.html`
- **Issue:** Each product shell is 8–32 lines. Contains only:
  1. A hash redirect (`window.location.hash = '#/products/{slug}'`)
  2. A sticky WhatsApp bar
- **Impact:** Search engines indexing these URLs directly see zero product content — no `<h1>`, no description, no price, no schema.
- **Fix:** Inject full product content (hero, description, ingredients, price, FAQ) into each static shell. Use the same React component markup but rendered server-side or pre-rendered into the HTML.

#### 1.3 Schema.org duplication and irrelevance
- **Files:** `index.html`, `contact/index.html`, `science/index.html`, `story/index.html`, `testimonials/index.html`, `protocol/index.html`
- **Issue:** Every single page embeds the FULL schema set: all 6 Products, all 4 LocalBusinesses, FAQPage, WebSite, Organization, and ItemList — regardless of page topic.
- **Impact:** 
  - Schema bloat (~50KB+ duplicated across 6 files = 300KB+ wasted)
  - Confuses search engines about which page is the canonical source for each entity
  - Rich snippets may be suppressed for irrelevant pages
- **Evidence:** `protocol/index.html` includes Product schemas for Day Cream, Night Cream, etc. even though it's a protocol page.
- **Fix:** Each page should only include schemas relevant to its content:
  - Home → Organization + WebSite + ItemList
  - Product pages → Product schema for THAT product only + BreadcrumbList
  - Contact → LocalBusiness (relevant location only) + Organization
  - Protocol → HowTo + Organization
  - Blog articles → BlogPosting + BreadcrumbList + FAQPage (if applicable)

### 🟠 High

#### 1.4 Blog Open Graph images use mixed path types
- **Files:** `blog/index.html`, `blog/*.html`
- **Issue:** Some OG images use relative paths (`../assets/hero-editorial-1.jpg`) while others use absolute Unsplash URLs. Relative OG image paths may break when pages are shared from non-root paths.
- **Fix:** Use absolute URLs (`https://zerolines.life/assets/...`) for all `og:image` and `twitter:image` meta tags.

#### 1.5 Missing `robots.txt` and `sitemap.xml`
- **Files:** Root directory
- **Issue:** No `robots.txt` or `sitemap.xml` found in the project root.
- **Impact:** Search engines must discover all pages through crawling alone. The blog has 20+ articles that would benefit from a sitemap.
- **Fix:** Create `/robots.txt` pointing to `/sitemap.xml`. Generate a sitemap listing all static routes and blog articles.

#### 1.6 Canonical URLs use hash fragments
- **Files:** `index.html` (via `zlUpdateMetaTags`)
- **Issue:** The dynamic meta updater sets canonicals like `https://zerolines.life/#/science`.
- **Impact:** Canonicals with hash fragments are essentially ignored by search engines. All pages canonicalise back to `/`.
- **Fix:** With History API routing, canonicals should be clean URLs (`https://zerolines.life/science`).

### 🟡 Medium

#### 1.7 Blog category pages lack unique meta descriptions
- **Files:** `blog/category-*.html`
- **Issue:** Category pages likely share generic or missing meta descriptions.
- **Fix:** Ensure each category page has a unique `<meta name="description">`.

---

## 2. Accessibility (WCAG 2.1) Audit

### 🔴 Critical

#### 2.1 Quiz module lacks ARIA live regions for dynamic content
- **Files:** `index.html` (quiz JavaScript)
- **Issue:** The quiz uses `innerHTML` injection to render questions, results, and analysis steps without `aria-live` regions. Screen reader users hear nothing when:
  - A new question appears
  - The "Analysing" animation runs
  - Results are rendered
- **Evidence:**
  ```js
  document.getElementById('zl-results-score').innerHTML = scoreHtml;
  document.getElementById('zl-results-summary').innerHTML = summary;
  ```
- **Fix:** Add `aria-live="polite"` containers for quiz status updates. Wrap the question container and results container in live regions, or use `role="status"` for the analysing steps.

#### 2.2 Photo upload input is completely hidden with no accessible label
- **Files:** `index.html`
- **Issue:** The photo upload uses `<input type="file" style="display:none">` triggered by a clickable div. There is no `<label>` element associated with the input, and the input is hidden from assistive technology.
- **Impact:** Screen reader users cannot discover or activate the photo upload.
- **Fix:** Add `aria-label="Upload a photo of your skin"` to the hidden input AND ensure the clickable upload area has `role="button"` with `tabindex="0"` and keyboard activation (Enter/Space).

#### 2.3 Newsletter forms use `FORM_ID_PLACEHOLDER` — completely broken
- **Files:** `blog/*.html`, `index.html`
- **Issue:** Multiple newsletter/waitlist forms submit to `https://formspree.io/f/FORM_ID_PLACEHOLDER`.
- **Impact:** Forms will silently fail or return errors. Users (including screen reader users) receive no meaningful error feedback.
- **Evidence:**
  ```html
  <!-- blog/inside-the-lab.html -->
  <form action="https://formspree.io/f/FORM_ID_PLACEHOLDER" method="POST">
  ```
  ```html
  <!-- index.html waitlist modal -->
  <form id="zl-waitlist-form" action="https://formspree.io/f/FORM_ID" method="POST">
  ```
- **Fix:** Replace all placeholders with actual Formspree IDs. Add proper error handling and accessible status messages.

### 🟠 High

#### 2.4 Global `outline: none` removes visible focus indicators
- **Files:** `assets/index-BELDyRU9.css` (line 3463)
- **Issue:**
  ```css
  input:focus, textarea:focus, select:focus, button:focus, a:focus {
    outline: none;
    border-color: #0ABAB5;
    box-shadow: 0 0 0 3px rgba(10, 186, 181, 0.15);
  }
  ```
- **Impact:** Keyboard-only users rely on visible focus indicators. While a box-shadow is provided, it fails WCAG 2.4.7 Focus Visible because:
  - The shadow is very subtle (15% opacity)
  - Elements without borders (e.g., plain `<button>` or `<a>` without border) will show no visible change on focus
  - High-contrast mode may suppress box-shadow entirely
- **Fix:** Add `:focus-visible` with a stronger indicator — e.g., `outline: 2px solid #0ABAB5; outline-offset: 2px;` for keyboard focus only.

#### 2.5 Blog mobile nav toggle lacks `aria-expanded`
- **Files:** `blog/index.html`, `blog/*.html`
- **Issue:** The hamburger button toggles `.is-open` class on the nav but never updates `aria-expanded`.
- **Evidence:**
  ```html
  <button class="zl-blog-nav-toggle" onclick="document.querySelector('.zl-blog-header-nav').classList.toggle('is-open')" aria-label="Menu">
  ```
- **Fix:** Add `aria-expanded="false"` initially and toggle to `"true"` when open. Consider moving the toggle handler to a named function for easier ARIA management.

#### 2.6 Quiz module has no focus trap
- **Files:** `index.html`
- **Issue:** When the quiz is opened (it covers the full viewport), keyboard users can Tab out of the quiz and navigate the underlying page.
- **Fix:** Implement a focus trap that keeps Tab cycling within the quiz while it's open. Also add `aria-hidden="true"` to the rest of the page content when the quiz is active.

#### 2.7 Product shells have no heading structure
- **Files:** `products/*/index.html`
- **Issue:** No `<main>`, no `<h1>`, no semantic landmarks. The only content is a sticky bar.
- **Impact:** Screen reader users landing on these pages directly have no orientation.
- **Fix:** As noted in SEO section, inject full semantic product markup with proper heading hierarchy.

#### 2.8 Waitlist modal lacks focus trap
- **Files:** `index.html`
- **Issue:** The waitlist overlay (`#zl-waitlist-overlay`) does not trap focus. Tabbing past the form moves focus to the underlying page.
- **Fix:** Implement focus trap (or use `<dialog>` element which handles this natively). Return focus to the trigger button on close.

### 🟡 Medium

#### 2.9 Cookie banner may not be dismissible by keyboard
- **Files:** `index.html`
- **Issue:** The cookie banner markup is dynamically injected. Need to verify the accept/decline buttons are keyboard-focusable and the banner can be closed via keyboard.
- **Fix:** Ensure cookie banner buttons are real `<button>` elements (not `<div>`), are in the tab order, and have visible focus indicators.

#### 2.10 Blog article inline images lack `loading="lazy"`
- **Files:** `blog/*.html`
- **Issue:** Hero images and some inline images don't use `loading="lazy"`. While hero images should NOT be lazy-loaded, check that below-the-fold images do.
- **Note:** The landing page cards and related reading cards already use `loading="lazy"` — this is good.

#### 2.11 WhatsApp floating button may overlap content on mobile
- **Files:** `index.html`, `products/*/index.html`
- **Issue:** `.zl-whatsapp-float` is fixed at `bottom: 80px` on mobile to avoid the sticky product bar, but on pages without the sticky bar it still sits at 80px.
- **Fix:** Ensure the button position adapts to whether the sticky bar is present, or use `bottom: 24px` consistently with safe-area-inset for notched devices.

---

## 3. Technical & Performance

### 🔴 Critical

#### 3.1 Duplicate quiz markup across all top-level pages
- **Files:** `index.html`, `contact/index.html`, `science/index.html`, `story/index.html`, `testimonials/index.html`, `protocol/index.html`
- **Issue:** The entire quiz module (`#zl-quiz-module`) is copy-pasted verbatim into every top-level static shell. This is ~1000+ lines of HTML/JS/CSS duplicated 6 times.
- **Impact:**
  - Maintenance nightmare — any quiz update requires editing 6 files
  - Increases build size significantly
  - Risk of drift between copies
- **Fix:** Move quiz markup to a shared JS module or server-side include. Alternatively, since the SPA already handles routing, only include the quiz in `index.html` and ensure it's available globally.

### 🟠 High

#### 3.2 Formspree integration incomplete
- **Files:** `index.html`, `blog/*.html`
- **Issue:** As noted in accessibility, `FORM_ID_PLACEHOLDER` means all newsletter and waitlist submissions will fail.
- **Fix:** Replace with real Formspree IDs and test end-to-end.

#### 3.3 Google Analytics / Meta Pixel placeholders
- **Files:** `index.html`
- **Issue:** GA4 and Meta Pixel scripts appear to be placeholders or empty.
- **Fix:** Either remove the placeholder comments/script tags or implement the real tracking IDs.

#### 3.4 No `404.html` customisation verification
- **Files:** `404.html`
- **Issue:** A `404.html` exists but was not audited in this pass. Ensure it has proper heading structure, navigation, and does not redirect into a broken SPA state.

### 🟡 Medium

#### 3.5 Blog CSS lacks `prefers-reduced-motion`
- **Files:** `blog/blog.css`
- **Issue:** The blog CSS has fade-up animations (`zlFadeUp`, `radarPulse`, card hover transforms) but no `@media (prefers-reduced-motion: reduce)` overrides.
- **Fix:** Add the same reduced-motion media query used in the main CSS:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```

#### 3.6 Lenis smooth scroll without reduced-motion check
- **Files:** `index.html` (JS)
- **Issue:** Lenis smooth scroll is initialised globally without checking for `prefers-reduced-motion`.
- **Fix:** Conditionally disable Lenis when the user prefers reduced motion:
  ```js
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // init Lenis
  }
  ```

---

## 4. Positive Findings (Keep Doing)

| Finding | Location | Notes |
|---------|----------|-------|
| ✅ `lang="en-GB"` | All HTML files | Correct language declaration |
| ✅ Skip link | `index.html` | `.zl-skip-link` targets `#root` |
| ✅ Descriptive alt text | Blog images | No empty `alt=""` found in blog |
| ✅ `<time datetime>` | Blog articles | Machine-readable dates used |
| ✅ `aria-label` | Search, newsletter, back-to-top | Good labelling |
| ✅ `aria-current="page"` | Blog breadcrumbs | Current page marked correctly |
| ✅ `prefers-reduced-motion` | `assets/index-BELDyRU9.css` | Comprehensive override at line 3400 |
| ✅ Waitlist modal ARIA | `index.html` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape key support |
| ✅ WhatsApp float label | `index.html` | `aria-label="Chat on WhatsApp"` |
| ✅ SVGs marked decorative | Trust bars | `aria-hidden="true"`, `focusable="false"` |
| ✅ Blog heading hierarchy | `blog/*.html` | Proper `h1` → `h2` → `h3` structure |
| ✅ BreadcrumbList schema | Blog articles | Structured breadcrumb data present |
| ✅ BlogPosting schema | Blog articles | Rich snippet eligible |
| ✅ `loading="lazy"` | Blog cards | Performance-conscious image loading |
| ✅ Focus states | `assets/index-BELDyRU9.css` | Custom focus ring using `box-shadow` (could be stronger) |
| ✅ Preconnect hints | All pages | `fonts.googleapis.com` and `fonts.gstatic.com` |

---

## 5. Priority Fix Roadmap

### Phase 1 — Pre-Launch (Critical)
1. **Replace all `FORM_ID_PLACEHOLDER` values** with real Formspree IDs
2. **Fix SPA routing** — migrate from hash-based to History API with server-side fallback
3. **Add real content to product shells** — inject semantic markup, headings, descriptions, schemas
4. **Add `aria-live` regions to quiz** — announce question changes and results to screen readers
5. **Fix photo upload accessibility** — associate label, make keyboard-activatable

### Phase 2 — High Priority (Week 1)
6. **Fix global focus indicators** — add `:focus-visible` with solid `outline`
7. **Implement focus traps** — quiz module and waitlist modal
8. **Deduplicate schemas** — each page gets only relevant schemas
9. **Fix blog nav `aria-expanded`** — toggle attribute with menu state
10. **Add `robots.txt` + `sitemap.xml`**

### Phase 3 — Polish (Week 2–3)
11. **Add `prefers-reduced-motion` to blog CSS**
12. **Conditionally disable Lenis** for reduced-motion users
13. **Audit and fix all OG image paths** to absolute URLs
14. **Remove quiz markup duplication** from top-level pages (or use shared include)
15. **Implement custom 404 page** with proper navigation

---

## 6. Files Audited

| File | Lines | Key Focus |
|------|-------|-----------|
| `index.html` | 3602 | Quiz module, schemas, meta updater, waitlist modal, cookie banner |
| `assets/index-BELDyRU9.css` | 3617 | Animations, focus states, reduced-motion, component styles |
| `assets/index-CdnbiGbM.js` | minified | React routing, page components |
| `products/*/index.html` | 8–32 each | Thin redirect shells |
| `contact/index.html` | ~3000 | Duplicate quiz + schemas |
| `science/index.html` | ~3000 | Duplicate quiz + schemas |
| `story/index.html` | ~3000 | Duplicate quiz + schemas |
| `testimonials/index.html` | ~3000 | Duplicate quiz + schemas |
| `protocol/index.html` | ~3000 | Duplicate quiz + schemas + HowTo |
| `blog/index.html` | ~400 | Landing, categories, search |
| `blog/blog.css` | 2281 | Blog styles, animations |
| `blog/complete-guide-skin-aging.html` | 394 | Article structure, schemas |
| `blog/zero-lines-protocol.html` | 419 | Article structure, schemas |
| `blog/inside-the-lab.html` | 322 | Article structure, schemas |
| `blog/why-pyrenean-mineral-water.html` | 312 | Article structure, schemas |

---

*Report generated by codebase exploration specialist.*
