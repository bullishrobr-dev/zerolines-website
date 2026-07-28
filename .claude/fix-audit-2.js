/* Fixes for the four structural defects the adversarial audit found.
 * Each was invisible to the scripted checks, which is itself worth recording.
 */
const fs = require('fs');
const path = require('path');
const CSS = path.resolve(__dirname, '..', 'assets', 'zl.css');
let css = fs.readFileSync(CSS, 'utf8');
const before = css;
const applied = [];

/* ---- 1. The mobile menu had no visible close control ---------------------
 * The header sits at z-index 100 over the menu at 99, transparent, inheriting
 * dark ink. On the near-black menu that put the logo and the burger at exactly
 * 1.00:1 — a black screen with nav links and no way out. Escape worked, which
 * nobody would guess. a11y.js could not see it: the menu is a SIBLING overlay
 * and the checker only walks ancestor backgrounds.
 */
if (!css.includes('[data-menu="open"] .zl-header')) {
  css = css.replace(
    '.zl-menu[data-open="true"] { display: flex; }',
    `.zl-menu[data-open="true"] { display: flex; }
/* While the menu is open the header paints over a near-black field, so it must
   invert. Without this the logo and the close control sit at 1.00:1 — invisible
   — and there is no discoverable way to shut the menu. */
[data-menu="open"] .zl-header,
[data-menu="open"] .zl-header .zl-logo { color: var(--on-dark); }
[data-menu="open"] .zl-header { background: transparent; border-bottom-color: transparent; }
[data-menu="open"] .zl-burger { color: var(--on-dark); }`
  );
  applied.push('menu-open header inversion');
}

/* ---- 2. Six pages lost their hero ----------------------------------------
 * Rebuilding the homepage hero replaced .zl-hero__grid / .zl-hero__media with
 * .zl-hero__photo / .zl-hero__inner, but faq, contact, products, testimonials,
 * science and story still use the old classes. With no matching rules the grid
 * fell back to display:block and the media stacked full-width underneath —
 * products/index.html rendered a 2261px hero on a 900px viewport.
 * Both patterns are legitimate, so both now exist.
 */
if (!css.includes('.zl-hero__grid')) {
  css = css.replace(
    '/* Champagne hairline under the hero — the first metallic note on the page */',
    `/* Split hero — type beside a boxed portrait. Used by the content pages, where a
   full-bleed photograph would overwhelm a page that is mostly reading. */
.zl-hero__grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 5vw, 5rem); align-items: center; width: 100%;
}
.zl-hero__media { position: relative; }
.zl-hero__media .zl-media { aspect-ratio: 4 / 5; position: relative; z-index: 1; }
.zl-hero__media::before {
  content: ""; position: absolute; z-index: 0;
  inset: 14% -9% 8% 28%; background: var(--sage-wash);
}
@media (max-width: 900px) {
  .zl-hero__grid { grid-template-columns: 1fr; gap: clamp(2rem, 5vh, 3rem); }
  .zl-hero__media::before { inset: auto -6% -5% 30%; height: 55%; }
}

/* Champagne hairline under the hero — the first metallic note on the page */`
  );
  applied.push('restored split-hero classes');
}

/* ---- 3. Mobile hero: type was sitting on the bare photograph --------------
 * The vertical wash reached alpha 0 at y=559 while the lead ran to 492 and the
 * buttons to 651, so the closing lines and the ghost CTA lay across her hands
 * and hair. Fighting this with a longer gradient means veiling most of the
 * picture anyway — so on narrow screens the photograph takes the top of the
 * frame and the type sits beneath it on solid bone. Legible by construction.
 */
if (!css.includes('--hero-split-mobile')) {
  css = css.replace(
    /@media \(max-width: 900px\) \{\n  \/\* Portrait crop on narrow screens[\s\S]*?\.zl-hero__actions \.zl-btn \{ width: 100%; \}\n\}/,
    `@media (max-width: 900px) {
  /* --hero-split-mobile: the picture owns the top of the frame, the type sits
     below it on solid bone. No overlay, so nothing depends on a gradient
     happening to be dark enough where a line of text lands. */
  --hero-split-mobile: 46vh;
  .zl-hero {
    min-height: 0; display: block;
    padding-top: 0; padding-bottom: clamp(2.5rem, 7vh, 4rem);
  }
  .zl-hero__photo { position: relative; height: 46vh; min-height: 300px; }
  .zl-hero__photo img { object-position: var(--hero-pos-mobile, 60% 22%); }
  .zl-hero__photo::after { background: none; }
  .zl-hero__photo::before {
    height: calc(var(--header-h) + 24px);
    background: linear-gradient(to bottom, rgba(250,247,242,.92) 0%, rgba(250,247,242,0) 100%);
  }
  .zl-hero__inner { padding-top: clamp(2rem, 5vh, 3rem); }
  .zl-hero__title { max-width: 12ch; }
  .zl-hero__lead  { max-width: none; }
  .zl-hero__actions .zl-btn { width: 100%; }
}`
  );
  applied.push('mobile hero: photo above, type on bone');
}

/* ---- 4. The cookie notice was covering content all the way down -----------
 * Measured on mobile: it obscured main content at 23 of 32 sampled scroll
 * positions — 72% of the journey — including the whole body of the "Over time"
 * panel. A 148px card that is 92% of the viewport width blanks a band of the
 * single content column at nearly every depth. Reserving space at the foot of
 * the document only ever helped at the very bottom.
 * Now a slim single-line bar: far less surface, and still dismissible in one tap.
 */
if (!css.includes('zl-cookie--slim')) {
  css = css.replace(
    /\.zl-cookie \{[\s\S]*?\n\}/,
    `.zl-cookie {
  /* zl-cookie--slim: one line, hugging the bottom edge. The previous card was
     360x148 and sat over the content column at 72% of scroll positions. */
  position: fixed; z-index: 95; left: 0; right: 0; bottom: 0;
  background: var(--ink); color: var(--on-dark-2);
  padding: 0.75rem clamp(1rem, 4vw, 2rem);
  display: flex; align-items: center; justify-content: center;
  gap: 0.75rem 1.5rem; flex-wrap: wrap;
  font-size: 0.8125rem; line-height: 1.5;
  box-shadow: 0 -6px 30px rgba(0, 0, 0, 0.16);
  transform: translateY(101%);
  transition: transform 620ms var(--ease);
}`
  );
  css = css.replace(
    '.zl-cookie[data-open="true"] { opacity: 1; transform: none; pointer-events: auto; }',
    '.zl-cookie[data-open="true"] { transform: none; }'
  );
  css = css.replace(
    /@media \(max-width: 560px\) \{ \.zl-cookie \{[^}]*\} \}/,
    `@media (max-width: 560px) {
  .zl-cookie { gap: 0.625rem 1rem; padding: 0.75rem 1rem; }
  .zl-cookie > span { flex: 1 1 100%; }
}`
  );
  css = css.replace(
    '.zl-cookie .zl-btn { padding: .6875rem 1rem; font-size: .625rem; flex: 1; }',
    '.zl-cookie .zl-btn { padding: .5625rem .9375rem; font-size: .625rem; }'
  );
  applied.push('slim cookie bar');
}

/* The WhatsApp button must clear the bar rather than sit on it. */
if (!css.includes('body[data-cookie-open]')) {
  css = css.replace(
    '.zl-wa:hover { transform: translateY(-3px); background: var(--house); }',
    `.zl-wa:hover { transform: translateY(-3px); background: var(--house); }
body[data-cookie-open="true"] .zl-wa { bottom: calc(1.5rem + 52px); }`
  );
  applied.push('float clears the bar');
}

fs.writeFileSync(CSS, css);
console.log(css === before ? 'no change' : 'applied:\n  - ' + applied.join('\n  - '));
