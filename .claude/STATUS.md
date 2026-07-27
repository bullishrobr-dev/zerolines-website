# Zero Lines — overnight status

**Branch:** `redesign/luxury-rebuild` · **`main` is untouched.** The live site has not changed.
Nothing here is deployed until you merge. Preview locally with:

```bash
node .claude/devserver.js
```

then open http://localhost:8420

---

## The one decision that shaped everything

Your homepage was rendered by `assets/index-CdnbiGbM.js` — a **504 KB React + GSAP bundle
whose source code is not in this repository**. It could not be edited, only replaced.

It was also the direct cause of all three symptoms you described:

- **"lags and jumps between pages"** — the bundle mounted, then a hard-reload hack fired on
  every product navigation.
- **"animations don't flow properly"** — its scroll-reveal timeline threw
  `GSAP target undefined not found`, leaving **163 of 645 homepage elements permanently at
  `opacity: 0`**. A quarter of your homepage never became visible at all.
- **"the hero on mobile looks odd"** — the H1 was white text on a cream background, its hero
  image 404'd, and its per-word animation spans had eaten the spaces: it literally rendered
  "AlreadyKnows" and "toRepair".

So the redesign and the bug-fixing were the same job. I rebuilt the homepage as hand-authored
static HTML and retired the bundle from it.

---

## Done and verified

| | Was | Now |
|---|---|---|
| **Homepage** | React bundle, 163 elements invisible, blank hero | Static HTML on a new design system. **0 invisible elements, 0 broken images** at 1440px and 390px |
| **Product pages (×6)** | Every hero and editorial image broken | All 12 images render |
| **Email forms (×27)** | Posted to a dead Formspree placeholder — **no signup has ever been captured** | Netlify Forms. Works with JS disabled |
| **Content pages (×5)** | CSS and JS both 404'd; pages rendered unstyled | Assets load; invisible elements 53 → 8 |
| **Internal links** | 65 broken across 13 files | **All 1,654 resolve** |
| **Social sharing** | All 54 `og:image` URLs 404'd — blank previews on WhatsApp | 28 real 1200×630 cards |
| **Service worker** | Cache-first, version never bumped — returning visitors pinned to an old copy **forever** | Network-first for HTML |
| **404s** | Every dead URL returned the homepage at HTTP 200 | Real 404s |

### The new design language
`assets/zl.css` — bone `#FAF8F4` and warm ink `#0E0F0E`, Cormorant Garamond display type,
squared buttons, tracked-out uppercase labels, heavy expo-eased motion, fluid type and spacing.

The old bright turquoise `#0ABAB5` is gone from the new work. It read as wellness-startup, not
luxury. It is replaced by a muted verdigris `#3A5952` used on under 5% of any screen, with the
existing gold `#9C8149` as a rare metallic hairline.

**The key engineering rule:** content is now visible by default, and animation is opt-in via a
class set synchronously before paint — plus a hard 2.5s failsafe timer. If the JavaScript fails,
errors, or never runs, every word still appears. That inversion is what your old build got
wrong, and it is why a quarter of the page was invisible.

---

## ⚠ Three things that need YOU — I did not "fix" these on purpose

These are not style calls. They carry real legal exposure for a cosmetics brand selling into
the UK and EU, and I was not willing to carry them into a redesign and make them look more
credible. Full detail in `.claude/CONTENT_INVENTORY.md` §5.

**1. Clinical claims that cannot be substantiated.** The site states "94% saw visible lifting"
(31 women, 10 weeks), "96% reported improved hydration" (42 women), "91% saw reduced fine
lines", "89% saw brighter complexion", "100% reported smoother texture", "increases collagen
density by up to 34% in 12 weeks", plus "Dermatologist approved" and "Clinically tested" — with
an asterisk but **no substantiating footnote anywhere on the site**. The brand has not launched
and has no products. Claims of completed trials on named panel sizes, for products that do not
yet exist, breach the UK CAP Code and the EU Unfair Commercial Practices Directive.
→ **Substantiate with real studies, or remove.** I left them off the new homepage.

**2. Eight named testimonials for a product never sold.** Isabella M., Claire R., Sophie L.,
Elena K., Margaux D., Anna S., Catherine W., Laura B. — attributed to "early testing" and shown
on the homepage carousel, while `/testimonials` simultaneously says the space awaits stories
"once the protocol is live". Fabricated consumer testimonials are prohibited outright.
→ **Remove until you have real, attributable ones.** I left them off the new homepage.

**3. "20,000+ analyses" and "2,000+ AI Skin Analyses"** — two different numbers for the same
metric, on a site with no analytics installed. Neither can be verified.

Also worth reconciling: "two years of development" (faq.html) vs "four years" everywhere else;
"all four products" vs six formulations; springs at 1,800 m vs 2,000 m; © 2025 vs © 2026.

---

## Not done — and I want to be straight with you about why

I hit the **session usage limit** partway through, which killed several research agents. I chose
to spend the remaining capacity on things that are verified working rather than start a large
refactor I could not finish and would have left half-broken.

**Still on the old design:**
- `/science`, `/story`, `/protocol`, `/testimonials`, `/contact` — these now *work* (assets load,
  content is visible) but still wear the old teal look and still run the React bundle. Their
  real copy lives inside that bundle; I transcribed it into `CONTENT_INVENTORY.md` §3 so it can
  be rebuilt without loss.
- `/products/*` and the 31 blog pages — functional and unbroken, but not yet restyled.
- `/analyser/` — the AI quiz works end to end (verified: "Question 1 of 10" renders, no errors),
  but it is the old homepage file with React suppressed by CSS. It needs a proper port.

**Two placeholders I could not fill** because they need values only you have:
- GA4 is still `G-XXXXXXXXXX` and Meta Pixel `000000000000000`. You have **zero analytics**.
  Send me the IDs and it is a one-line change each.

**Product photography.** The six product images have inconsistent backgrounds — white, cream,
pink, teal — so the collection grid reads as six unrelated objects rather than one line. No CSS
fixes that; it needs consistent shots on one seamless background. This is the single biggest
remaining gap between the site and the La Mer / Augustinus Bader tier.

---

## Suggested order when you're back

1. Look at the new homepage and tell me if the direction is right — everything else follows from it.
2. Decide on the claims and testimonials above.
3. Send GA4 + Meta Pixel IDs.
4. I rebuild the 5 content pages, then restyle products and blog to match.
5. Port the analyser onto the new system.

## Tools I left you

```bash
node .claude/linkcheck.js                    # every internal link, one command
node .claude/shoot.js / /products /blog/     # invisible-element + broken-image counts
node .claude/shoot-vp.js / mobile 0          # viewport screenshots at any scroll offset
```
