# Zero Lines — build brief for page authors

Read this in full before writing any HTML. `/Users/metabt/Desktop/ZLweb/index.html`
is the reference implementation — match its structure, class usage and quality.

## Absolute rules

1. **NO PRICING ANYWHERE.** The products are not for sale. Remove every `£` figure.
   Say "not yet available to purchase" where price would have gone.
2. **NO fabricated testimonials.** Do not use the names Isabella M., Claire R.,
   Sophie L., Elena K., Margaux D., Anna S., Catherine W. or Laura B. anywhere.
3. **NO unsubstantiated clinical percentages.** Never write "94% saw visible
   lifting", "96% reported improved hydration", "91%", "89%", "100%", "34% collagen
   density", "clinically tested", "dermatologist approved", or any named trial panel
   ("31 women, 10 weeks"). The brand has not launched and has no products; these
   cannot be substantiated and are unlawful advertising in the UK/EU. Describe
   mechanism and intent instead — "designed to support", "formulated to".
4. **Links must be real absolute paths** — `/science`, `/products/serum`, `/blog/`.
   Never `#/science`, never `./assets/`, never a relative `cookies.html`.
   Every asset path starts `/assets/`.
5. **No `<picture>`/`.jpg` fallbacks.** Only `.webp` exists in `/assets`. Use a
   plain `<img src="/assets/x.webp">`.
6. **Never leave content hidden.** Only use the reveal attributes below; never
   write inline `opacity:0`. A previous build stranded 163 elements invisible.

## Required page skeleton

Copy the `<head>`, header, `#zl-menu`, footer, WhatsApp link, cookie notice and
the two closing `<script>` tags from `index.html` verbatim, changing only the
`<title>`, meta description, canonical, and OG title/description/image.
Every page must carry: `.zl-progress`, `.zl-skip`, `<main id="main">`.

Nav order everywhere: Science · Protocol · Formulations · Story · Analyser ·
Journal · Contact.

## Design system — `/assets/zl.css`

**Colour.** Tiffany turquoise `--tiffany: #0ABAB5` is THE brand colour. Use it
confidently but never as wallpaper — roughly one bold turquoise moment per page,
plus the small recurring signatures (eyebrow ticks, index numerals, nav
underlines, link hovers). `--tiffany-deep: #06736F` for turquoise text on light.
Surfaces: `--bone`, `--bone-2` (`.zl-tint`), `--ink` (`.zl-dark`),
`.zl-brand-field` (full-bleed turquoise), `.zl-wash` (pale turquoise).

**Type.** `.zl-display-xl/l/m/s`, `.zl-lead`, `.zl-eyebrow`, `.zl-prose`, `.zl-num`.
Put exactly one `<em class="zl-em--brand">` in most headlines — one italic
turquoise word. Do not overuse it.

**Layout.** `.zl-container` (`--mid`, `--narrow`), `.zl-section` (`--sm`),
`.zl-grid--2/3/4`, `.zl-split` (`--wide-img`, `--wide-txt`),
`.zl-index-rule` with `.zl-index-rule__num`.

**Components.** `.zl-btn` (`--brand`, `--ghost`, `--light`, `--on-brand`,
`--on-dark-ghost`), `.zl-link` with `.zl-link__arrow`, `.zl-media`
(`--portrait/--square/--editorial/--wide/--cinema/--tall`, `--zoom`),
`.zl-card`, `.zl-product`, `.zl-input`, `.zl-form__status`.

## Motion — this is what the owner said was "boring and blunt". Use the full range.

- `data-reveal` — rise+fade. `data-reveal="fade"`, `="far"`, `="wipe"`.
- `data-reveal="wipe"` — **use for every significant image.** Clip-path reveal
  with the image settling from 1.12 scale. Far richer than a fade.
- `data-stagger` on a grid/list — children animate in sequence automatically.
- `.zl-rise` wrapping display headlines: `<span class="zl-rise"><span>One line</span></span>`,
  one per line. Never split per word — that ate the spaces in a previous build.
- `.zl-draw` on a hairline to draw it in.
- `data-parallax="0.08"` on an `<img>` inside `.zl-media`. Keep 0.05–0.12.
- `data-count="34" data-count-suffix="%"` for animated numerals.
- `--reveal-delay:120ms` inline to sequence a composition.

Vary it. A page where everything does the same rise reads cheap.

## Imagery — `/assets`, all `.webp`

Portraits: `hero-model-senior-caucasian-woman`, `-mature-black-woman`,
`-mature-asian-woman`, `-middle-aged-latina`, `-middle-aged-caucasian-man`,
`-young-latina`, `-young-south-asian-woman`, `-young-southeast-asian-woman`,
`-young-black-woman-profile`.
Texture/atmosphere: `atmosphere-serum-texture`, `-teal-gel-swatch`,
`-cream-texture`, `-botanical-petal`, `-daily-ritual`, `-morning-ritual`,
`-application-ritual`, `-spa-ritual`, `-neck-skin-detail`, `-hero-split`.
Science: `science-hero-dna-cellular`, `-skin-macro-droplets`, `-peptide-molecular`,
`-bubbles-macro`, `-cellular`, `-minerals`, `-lab-interior`, `-researcher-lab`,
`-dna`, `-peptides`.
Story: `story-pyrenean-mountains-dawn`, `-alpine-spring-water`, `-alpine-crystals`,
`-pyrenees-to-sea`, `-clinic-interior`, `-barcelona-architecture`, `-laboratory`,
`-springs`, `-skin`, `-pyrenees`.
Product: `product-peeling-gel`, `product-syringe`, `product-serum`,
`product-day-cream`, `product-night-cream`, `product-syringe-refill`,
`product-syringe-hero`, `hero-serum-application`, `hero-peeling-facial`,
`hero-syringe-beforeafter`, `night-sleeping-woman`.

The turquoise gel images (`atmosphere-teal-gel-swatch`, `atmosphere-serum-texture`)
are the brand colour occurring naturally — use them where the page needs a
turquoise moment. Both sit on white, so give them
`style="object-fit:contain;mix-blend-mode:multiply"` and a light background.

## Copy

`.claude/CONTENT_INVENTORY.md` holds the recovered copy for every page, including
text that exists only inside the old React bundle. Use it. Preserve the brand
voice lines: "We restore the signal.", "We don't treat symptoms. We activate
biology.", "We are the instructions.", "Not anti-aging. Skin intelligence."

British spelling throughout (analyse, hydrolysed, colour, moisturiser).

## Verify before you finish

```bash
node .claude/linkcheck.js        # must print "all internal links resolve"
node .claude/shoot.js <path>     # must print invisible=0 brokenImgs=0
```
Fix anything either reports. Do not report success without running both.
