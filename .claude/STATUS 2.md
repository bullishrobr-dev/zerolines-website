# Zero Lines — status

**Branch:** `redesign/luxury-rebuild` · **`main` is untouched.** Nothing is deployed until you merge.

```bash
node .claude/devserver.js     # then open http://localhost:8420
```

---

## ⚠ Read this first: two of your product photos were another brand's

`product-peeling-gel.webp` shows a tube printed **"AQUA PEL — DAILY EXFOLIATING GEL"**.
`product-syringe-refill.webp` shows a carton printed **"RENEU Skincare"**.

Both were on your homepage and product pages, presented as Zero Lines products. They're
AI-generated stock that came out carrying other brands' packaging. The other four correctly
show "zero lines".

I've swapped both for genuinely Zero Lines branded shots and quarantined the originals in
`assets/_do-not-use/`. **The refill still has no photograph of its own** — it currently borrows
the syringe shot, which is defensible (it's a cartridge for that applicator) but not right.

---

## What changed since you last looked

| Your feedback | What I did |
|---|---|
| "our Tiffany turquoise… I see it nowhere" | Restored as the lead colour. You were right — `#0ABAB5` *is* Tiffany Blue. The mistake was using it as pill buttons everywhere, not the colour itself |
| "you barely see the header" | Hero is light and split now — type left, portrait right. Header sits on bone and is opaque the moment you scroll |
| "not the right photo" | Senior portrait — dignified, mature, and it *is* the skin-longevity promise |
| "I don't want pricing" | Every `£` gone. Product pages close with "Not yet for sale" |
| "I don't like the illusion and activation section" | Deleted. Replaced with the full-bleed turquoise "We restore the signal" field |
| "animations are boring and blunt" | Real vocabulary now: clip-path wipes, masked line-rise, indexed stagger, parallax, counters, scroll progress, weighted inertial scroll |
| "I'm stuck in there, cannot get out" | **Found it.** The legacy pages rewrote their URL to `/science#/science` and their nav pointed at hash routes, so clicking "Testimonials" from `/science` gave `/science#/testimonials` — you never left. All rebuilt as static HTML |

## Pages rebuilt

Homepage · Science · Story · Protocol · Testimonials · Contact · Formulations + all 6 product
pages · Analyser · Thank-you · 404 · all 31 blog pages restyled · all 6 legal pages restyled.

**The React bundle is gone from every page on the site.**

## Verified, measured — not assumed

| Check | Result |
|---|---|
| Internal links | **2,817 references, all resolve** |
| Invisible elements | **0** across 12 pages × desktop + mobile |
| Broken images | **0** |
| Nav dead-ends | **0** — every link goes where it points |
| WCAG AA contrast | **0 failures** (was 54) |
| Prices on site | **0** |
| Fabricated testimonials | **0** |
| Unsubstantiated clinical claims | **0** |
| Hash routes / relative asset paths | **0** |

## Notable fixes from the audit

- **Contrast.** White on `#0ABAB5` measures 2.41:1 against a 4.5:1 requirement — every turquoise
  section and every primary CTA including the waitlist submit was failing. Ink on the same
  turquoise is 8.08:1, so turquoise is now a fill and text on it is ink. Your accessibility page
  publicly claims AA conformance, so this mattered beyond aesthetics.
- **Header ghosting.** Body text from dark sections was readable straight through the header —
  it was 82% opaque with a blur, and blur is not occlusion. Now fully opaque when scrolled.
- **Cookie notice.** On mobile it covered the Register button and made the privacy link
  genuinely unclickable. It now reserves space at the foot of the page so anything covered can be
  scrolled clear.

---

## Still needs you

1. **GA4 and Meta Pixel IDs** — still `G-XXXXXXXXXX` and `000000000000000`. You have zero
   analytics. One line each once you send them.
2. **Product photography.** The six shots are inconsistent — one is a wide landscape, one a full
   scene, and the refill has none of its own. `mix-blend-mode` normalises their backgrounds so
   they read as a set, but consistent shots on one seamless background is the single biggest
   remaining gap to the La Mer / Augustinus Bader tier.
3. **The claims decision still stands.** I removed the eight fabricated testimonials and every
   clinical percentage ("94% saw visible lifting", "34% collagen density", "dermatologist
   approved"). If you have real substantiation, they can come back. If not, they must stay out —
   they're unlawful in the UK/EU for a brand that hasn't launched.
4. **Content contradictions** I did not silently rewrite: `faq.html` said "two years of
   development" (four elsewhere) and "all four products" (six elsewhere) — those two I fixed.
   Still open: springs at 1,800 m vs 2,000 m.

## Tools left for you

```bash
node .claude/linkcheck.js     # every internal link
node .claude/a11y.js /        # real composited contrast + occlusion checks
node .claude/shoot.js /       # invisible-element and broken-image counts
node .claude/navtest.js       # crawls nav, reports dead ends
```
