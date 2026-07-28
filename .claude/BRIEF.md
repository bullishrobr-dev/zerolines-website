# Zero Lines — build brief

Read in full before writing HTML. `/Users/metabt/Desktop/ZLweb/index.html` is the reference.

---

## 1. THE BRAND IDEA — two effects in one (owner's own words, this is the spine)

Every Zero Lines product does **two things at once**, and the site must say so plainly:

- **The immediate effect** — visible from the very first application, that same day.
  For the Syringe: applied to expression lines, the skin looks visibly smoother within
  minutes and holds through the day. The owner's comparison: *like makeup, except it is
  skincare*. This is why the Refill exists — someone who only ever wants the immediate
  effect can keep using it affordably.
- **The lasting effect** — with consistent use over weeks, the skin's own structure is
  supported, so the lines have less to come back to.

Give this a named, repeated treatment on every product page — a two-column block,
"Immediately" / "Over time". It is the most distinctive thing about the range. It should
feel like *two products in one*.

### Claim discipline — read carefully, this is a legal boundary
Cosmetics may describe **appearance**. They may not claim to alter physiology permanently —
that is a medicinal claim and is unlawful in the UK/EU.

| Do not write | Write instead |
|---|---|
| "removes wrinkles" | "visibly smooths the appearance of lines" |
| "permanently reduces wrinkles" | "supports the skin's own structure, so lines have less to return to" |
| "erases" / "eliminates" | "softens" / "visibly refines" |
| any % figure, trial, panel size | nothing — we have no substantiation |
| "clinically proven / dermatologist approved" | "formulated to" / "designed to support" |

Never state a number. Never name a study. The brand has not launched and has no products.

---

## 2. Absolute rules

1. **NO PRICING.** Not for sale. Say "not yet available to purchase".
2. **No testimonials.** Never the names Isabella M., Claire R., Sophie L., Elena K.,
   Margaux D., Anna S., Catherine W., Laura B.
3. **No clinical percentages** (94/96/91/89/100/34%), no "panel of", no "clinically tested".
4. **Absolute links** — `/science`, `/products/serum`, `/blog/`. Never `#/`, never `./assets/`.
   All assets `/assets/*.webp`. No `<picture>`, no `.jpg`.
5. **Never leave content hidden.** Only the reveal attributes below; never inline `opacity:0`.
6. **British spelling** (analyse, hydrolysed, colour).
7. **Keep pages tight.** The owner asked for shorter than the last pass. Aim 6–8 sections of
   real substance. Cut anything that repeats.

---

## 3. Palette v3 — `/assets/zl.css`

The bright turquoise is no longer a surface. It is a mark.

| Token | Value | Use |
|---|---|---|
| `--bone` | `#FAF7F2` | page surface (alabaster) |
| `--bone-2` | `#F2EDE5` | `.zl-tint` sections |
| `--ink` | `#14181A` | text, `.zl-dark` sections |
| `--house` | `#1F4F4A` | **large brand areas**, `.zl-brand-field`, primary buttons, teal text |
| `--signal` | `#4FB3AC` | **rules, ticks, underlines, focus ONLY — never text** (2.35:1) |
| `--champagne` | `#C2A878` | hairlines, small caps, the metallic note |
| `--sage-wash` | `#E8EFEC` | `.zl-wash` tint |

`.zl-brand-field` is now a **deep teal field with light type** (8.05:1). Roughly one per page.
`.zl-em--brand` gives one italic house-teal word per headline. Do not overuse.

---

## 4. Motion — the owner said the last pass was "boring and blunt". Use the full range.

- `data-reveal` — rise+fade. Variants `="fade"`, `="far"`, `="wipe"`.
- `data-reveal="wipe"` — **every significant image.** Clip-path reveal, image settles from 1.12.
- `data-stagger` on a grid/list — children sequence automatically.
- `.zl-rise` per line of a display headline: `<span class="zl-rise"><span>One line</span></span>`.
  One per line. Never per word — that ate the spaces in an earlier build.
- `.zl-draw` on a hairline to draw it in.
- `data-parallax="0.08"` on an `<img>` inside `.zl-media`. Range 0.04–0.12.
- `data-count="12" data-count-suffix=" months"` for animated numerals.
- `--reveal-delay:120ms` inline to sequence a composition.

Vary it. A page where everything does the same rise reads cheap.

---

## 5. Imagery — `/assets`, all `.webp`

Portraits: `hero-model-middle-aged-latina` (the house face, ~45), `-senior-caucasian-woman`,
`-mature-black-woman`, `-mature-asian-woman`, `-middle-aged-caucasian-man`, `-young-latina`,
`-young-south-asian-woman`, `-young-southeast-asian-woman`, `-young-black-woman-profile`.
Texture: `atmosphere-serum-texture`, `-teal-gel-swatch`, `-cream-texture`, `-botanical-petal`,
`-daily-ritual`, `-morning-ritual`, `-application-ritual`, `-spa-ritual`, `-neck-skin-detail`.
Science: `science-hero-dna-cellular`, `-skin-macro-droplets`, `-peptide-molecular`,
`-bubbles-macro`, `-cellular`, `-minerals`, `-lab-interior`, `-researcher-lab`.
Story: `story-pyrenean-mountains-dawn`, `-alpine-spring-water`, `-alpine-crystals`,
`-pyrenees-to-sea`, `-clinic-interior`, `-barcelona-architecture`.
Product: `product-peeling`, `product-syringe`, `product-syringe-hero`, `product-serum`,
`product-day-cream`, `product-night-cream`, `hero-serum-application`, `hero-peeling-facial`,
`hero-syringe-beforeafter`, `night-sleeping-woman`.

**Never use** `product-peeling-gel.webp` or `product-syringe-refill.webp` — they carry other
brands' packaging and are quarantined in `assets/_do-not-use/`.

The gel images (`atmosphere-teal-gel-swatch`, `atmosphere-serum-texture`) sit on white —
give them `style="object-fit:contain;mix-blend-mode:multiply"` on a light background.

---

## 6. Verify before finishing

```bash
node .claude/linkcheck.js     # must print "all internal links resolve"
node .claude/a11y.js <path>   # must print contrastFails=0
node .claude/shoot.js <path>  # must print invisible=0 brokenImgs=0
```
Fix anything they report. Do not claim success without running all three.
