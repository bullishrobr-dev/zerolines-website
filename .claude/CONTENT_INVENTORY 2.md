# Zero Lines — Content Inventory & Integrity Audit
Generated 2026-07-28. Source of truth for the rebuild. Do not delete.

## 0. STRUCTURAL FACTS (corrected — earlier assumptions were wrong)

1. **`assets/index-CdnbiGbM.js` (504 KB React bundle) is the single largest copy store on the site.**
   All Science / Story / Protocol / Testimonials / Contact page copy, all homepage section copy,
   all 8 testimonials, and **all per-product ingredient lists** exist ONLY inside this bundle.
   **The bundle's source code is not in this repo.** Retiring it means re-authoring that copy as HTML.
2. Homepage: `#root` closes at line 490. Lines 493–713 are the static quiz module.
   **Lines 719–3642 are `<script>` blocks** — much user-facing copy lives in JS string literals.
3. The 5 "React shells" (science/story/protocol/testimonials/contact) are byte-identical apart
   from ~34 lines of head meta. Each carries the full quiz module + 14 JSON-LD blocks.

---

## 1. PRODUCTS — 6 SKUs, all `schema.org/PreOrder`

| # | Product | Price | Step | Card image |
|---|---------|-------|------|-----------|
| 1 | Bio-Renewal Peeling Gel | £125 | 01 · Weekly Exfoliation | `product-peeling-gel.webp` |
| 2 | Precision Collagen Activation Syringe | £485 | 02 · The Key Product | `product-syringe.webp` |
| 3 | BioSignal Facial Serum | £345 | 03 · Daily Treatment | `product-serum.webp` |
| 4 | Environmental Shield Day Cream | £295 | 04 · Morning Protection | `product-day-cream.webp` |
| 5 | Renewal and Repair Night Cream | £325 | 05 · Evening Repair | `product-night-cream.webp` |
| 6 | Precision Collagen Activation Refill | £195 | 06 · Continuation | `product-syringe-refill.webp` |

Every product page shares a 9-section template: Hero → Overview (H2 + 3 cards) → "Designed to
Support" (6 bullets) → Mechanism (+ warning box) → Application Protocol (4 steps) → Editorial
split → "Proven Results" (4 clinical items) → "The Ritual" (4 steps + 3 scarcity tags) → FAQ (8 Q&A)
→ CTA. Shared CTA: `wa.me/35054005198` with per-product prefilled text.

### Editorial headlines (keep — these are good)
- Peeling Gel — "Gentle power. Profound clarity."
- Syringe — "Targeted intervention. Transformative results."
- Serum — "Liquid light. Molecular intention."
- Day Cream — "Weightless silk. Boundless protection."
- Night Cream — "Overnight immersion. Dawn-to-dusk radiance."
- Refill — "From mountain spring to molecular mastery."

### Key ingredients (bundle-only — will be LOST if the bundle is dropped without transcribing)
- **Peeling Gel:** Aloe Vera Juice; Brown Algae Extract; Citric Acid + Cotton Seed
- **Syringe:** Hydrolyzed collagen; Botanical Extract Complex (witch hazel, calendula, chamomile,
  horse chestnut, peppermint, yarrow, mallow, linden, St. John's Wort); Botanical Signal Peptides
  (rose + chamomile flower waters)
- **Serum:** Botanical Peptide Complex (watermelon extract); hydrolyzed collagen; Pyrenean mineral water base
- **Day Cream:** Pyrenean Mineral Complex (zinc, selenium, copper); red algae + cucumber; sweet almond oil + shea butter
- **Night Cream:** Hydrolyzed collagen + shea butter; niacinamide; lavender floral water
- **Refill:** Hydrolyzed collagen; Botanical Extract Complex; Precision Cartridge System

### Six protocol step names
Renew · Activate · Signal · Shield · Restore · Sustain

---

## 2. BLOG — 25 articles (~29,100 words), 5 categories, index

All articles use one template and carry `datePublished: 2026-05-13`.
Hero images correctly use `../assets/*.webp`.

- **Science (6):** complete-guide-skin-aging · collagen-decline-biological-clock ·
  botanical-vs-synthetic-peptides · how-altitude-changes-water · fine-lines-vs-wrinkles ·
  understanding-skin-type
- **Ingredients (6):** hydrolyzed-collagen-myth-miracle · read-skincare-label ·
  niacinamide-ingredient-over-30 · algae-marine-ingredients · why-pyrenean-mineral-water ·
  andorra-alpine-secret
- **Routine (5):** zero-lines-protocol *(flagship)* · morning-vs-night-routine ·
  how-to-layer-skincare · weekly-exfoliation-vs-daily · first-30-days-protocol
- **Lifestyle (6):** sleep-repairs-skin · spf-every-day-habit · climate-skincare-needs ·
  cortisol-stress-aging · lifestyle-factors-aging · drinking-water-better-skin
- **Brand Story (2):** inside-the-lab · pyrenees-to-barcelona

This content is genuinely good and SEO-relevant. **Preserve all of it.**

---

## 3. RECOVERED PAGE COPY (bundle-only — transcribe before dropping the bundle)

**Homepage hero:** H1 "Your Skin Already / Knows How to / Repair Itself."
Lede: "**We Restore the Signal.** Zero Lines is a clinical-luxury Skin Longevity House. We don't
fight your biology. We activate it — using botanical science, botanical renewal technology, and
mineral complexes sourced from high-altitude Pyrenean springs."
Pull quote: *"We do not believe in erasing time. We believe in extending skin health, structure,
and function — measurably."*
Sections: Clinical Premise · "We are the instructions." · Peer-Reviewed Signal (3 stats) ·
The Illusion vs. The Activation · Dual-Action System (Flash Effect / Longevity Effect) ·
The Protocol · The Science That Powers It · Early Access · Testimonials · Footer

**Story:** "A Conviction, Not a Brand." · "Where the Water Begins" · "Our Line in the Sand /
What We Refuse to Do." · Pull quote: *"Zero Lines does not pursue younger-looking skin. It pursues
structurally younger skin. The distinction is everything."* · "This is Zero Lines. Not anti-aging.
Skin intelligence."

**Science:** "We don't treat symptoms. We activate biology." · "Cellular communication, restored." ·
"Ionic balance from the Pyrenees." · "Made in Barcelona / Engineered in Catalonia."

**Protocol:** "The Logic of Order / Why Protocol Sequencing Matters." · six step descriptors.

**Testimonials page:** currently a PLACEHOLDER awaiting launch.

---

## 4. BRAND VOICE — recurring lines to keep
- "We Restore the Signal."
- "Your Skin Already Knows How to Repair Itself."
- "We don't treat symptoms. We activate biology."
- "Not anti-aging. Skin intelligence."
- "Cellular Science. Alpine Precision."
- Descriptor: "Advanced Skincare Solutions" (39 files) / "Skin Longevity House"
- Nav order: Science · Protocol · Products · Story · Analyser · Testimonials · Contact · Journal
- Contact: info@ / privacy@ / legal@ / support@ / accessibility@ zerolines.life ·
  +350 54005198 · instagram.com/zerolines.life

`faq.html` (935 lines, 26 questions) is the richest brand-voice document in the repo. Preserve it.

---

# ⚠ 5. INTEGRITY PROBLEMS — MUST BE RESOLVED BY THE OWNER

These are not style issues. Several carry legal/regulatory exposure for a cosmetics brand
selling into the UK/EU. **Do not carry these forward into a redesign unchanged.**

### 5.1 Unsubstantiated clinical claims
The site states, with an asterisk but **no substantiating footnote anywhere**:
- "100% reported smoother texture" (panel of 35 women, 6 weeks)
- "94% saw visible lifting" (31 women, 10 weeks)
- "96% reported improved hydration" (42 women)
- "91% saw reduced fine lines" (38 women, 8 weeks)
- "89% saw brighter complexion" (44 women, 4 weeks)
- "Increases collagen density by up to 34% in 12 weeks"
- "Dermatologist approved" / "Ophthalmologist tested" / "Clinically tested"

The brand has **not launched and has no products**. Claims of completed clinical trials on named
panel sizes, for products that do not yet exist, are false advertising under the UK CAP Code and
the EU Unfair Commercial Practices Directive. **Either substantiate with real study references or
remove.**

### 5.2 Eight named testimonials for a product never sold
`assets/index-CdnbiGbM.js` contains 8 testimonials (Isabella M., Claire R., Sophie L., Elena K.,
Margaux D., Anna S., Catherine W., Laura B.) attributed to "early testing", displayed on the
homepage carousel — while `/testimonials` simultaneously says the space awaits stories "once the
protocol is live". Fabricated consumer testimonials are prohibited advertising practice.
**Remove until real, attributable testimonials exist.**

### 5.3 "20,000+ analyses" / "2,000+ AI Skin Analyses"
Two different numbers for the same metric, on a site with no analytics installed
(GA4 ID is still the placeholder `G-XXXXXXXXXX`), so neither can be true or verified.

### 5.4 Factual contradictions across pages
| Claim | Version A | Version B |
|---|---|---|
| Development time | "two years" (faq.html) | "four years" (everywhere else) |
| Product count | "all four products" (faq.html) | six formulations (everywhere else) |
| Spring altitude | 1,800 m | 2,000 m (refill editorial) |
| Copyright year | © 2025 (bundle footer) | © 2026 (HTML) |
| Accessibility review | "May 2025" | page dated 2026 |
| Return policy | "30-day satisfaction, no return required" (faq) | "unopened, unused within 30 days" (terms) |
| "PRNS Protocol" | defined in faq.html + bundle only | absent from all other HTML |

### 5.5 Blog category pages contradict the articles
Category pages use different titles, different dates, and assign articles to different categories
than the articles themselves declare. Treat as a data-integrity bug, not preserved copy.

---

# 6. FUNCTIONAL BUGS CONFIRMED

| Bug | Detail |
|---|---|
| **163 of 645 homepage elements stuck at `opacity:0`** | GSAP reveal animations error out ("GSAP target undefined not found"); a quarter of the page never becomes visible |
| **Hero H1 is white on a cream background** | and the hero image behind it 404s |
| **Hero headline loses word spaces** | renders "AlreadyKnows", "toRepair" — per-word animation spans dropped the gaps |
| **All 6 product detail pages: every hero + editorial image is broken** | they reference `./assets/…` which resolves to `/products/<slug>/assets/` — a directory that does not exist |
| **No `.jpg` exists anywhere in `/assets`** | every `<picture>` `.jpg` fallback and the `og:image` 404s → social share previews are blank |
| **All 27 email forms post to a placeholder** | `formspree.io/f/FORM_ID_PLACEHOLDER` (25 blog files) and `FORM_ID` (index.html ×2). No signup has ever been captured |
| **No analytics** | GA4 `G-XXXXXXXXXX`, Meta Pixel `000000000000000` |
| **Service worker serves stale content forever** | cache-first, hardcoded `zero-lines-v1`, never bumped → returning visitors never receive new deploys |
| **`404.html` is unreachable** | `_redirects` catch-all `/* /index.html 200` turns every bad URL into a soft-404 homepage with HTTP 200 |
| **Hash-routing leftovers** | 5 content pages still force `window.location.hash = '#/…'` despite the clean-URL migration |
| **Cart UI with no commerce** | bundle renders "Your bag is empty" / "Checkout coming soon" on a pre-launch site |
| **OG images point at `zero-lines-website.netlify.app`** | not the canonical `zerolines.life` |
