/* Bring every turquoise surface up to WCAG AA.
 *
 * Measured ratios that drove each change:
 *   white on #0ABAB5 ............ 2.41:1  FAIL (needs 4.5)
 *   ink   on #0ABAB5 ............ 8.08:1  PASS
 *   #0ABAB5 text on bone ........ 2.31:1  FAIL (fails even the 3:1 large-text floor)
 *   #06736F text on bone ........ 5.46:1  PASS
 *
 * So: turquoise stays as a FILL and as non-text rules/underlines, but any text
 * ON turquoise becomes ink, and any turquoise-coloured TEXT becomes --tiffany-deep.
 *
 * This matters beyond aesthetics: accessibility.html publicly claims WCAG 2.1 AA
 * conformance, and science/index.html says "We do not make claims we cannot
 * substantiate."
 */
const fs = require('fs');
const path = require('path');
const CSS = path.resolve(__dirname, '..', 'assets', 'zl.css');

let css = fs.readFileSync(CSS, 'utf8');
const before = css;

const EDITS = [
  // --- text sitting ON the turquoise field: white -> ink ------------------
  ['.zl-brand-field .zl-eyebrow { color: rgba(255,255,255,0.72); }',
   '.zl-brand-field .zl-eyebrow { color: rgba(11,13,13,0.66); }'],
  ['.zl-brand-field .zl-eyebrow::before { background: rgba(255,255,255,0.85); }',
   '.zl-brand-field .zl-eyebrow::before { background: rgba(11,13,13,0.7); }'],
  ['.zl-brand-field .zl-lead { color: rgba(255,255,255,0.9); }',
   '.zl-brand-field .zl-lead { color: rgba(11,13,13,0.82); }'],
  ['.zl-brand-field .zl-form__note { color: rgba(255,255,255,.75); }',
   '.zl-brand-field .zl-form__note { color: rgba(11,13,13,0.72); }'],
  ['.zl-brand-field .zl-form__status[data-state="ok"] { color: #fff; }',
   '.zl-brand-field .zl-form__status[data-state="ok"] { color: var(--ink); }'],
  ['.zl-on-dark .zl-em--brand, .zl-brand-field .zl-em--brand { color: var(--tiffany-lift); }',
   '.zl-on-dark .zl-em--brand { color: var(--tiffany-lift); }\n' +
   '/* on the turquoise field the accent word cannot be turquoise — go to full ink */\n' +
   '.zl-brand-field .zl-em--brand { color: var(--ink); }'],
  ['.zl-on-dark .zl-link:hover, .zl-brand-field .zl-link:hover { color: #fff; }',
   '.zl-on-dark .zl-link:hover { color: #fff; }\n.zl-brand-field .zl-link:hover { color: var(--ink); }'],
  ['.zl-on-dark .zl-input, .zl-brand-field .zl-input { color: #fff; border-bottom-color: rgba(255,255,255,.32); }',
   '.zl-on-dark .zl-input { color: #fff; border-bottom-color: rgba(255,255,255,.32); }\n' +
   '.zl-brand-field .zl-input { color: var(--ink); border-bottom-color: rgba(11,13,13,.3); }'],
  ['.zl-on-dark .zl-input::placeholder, .zl-brand-field .zl-input::placeholder { color: rgba(255,255,255,.55); }',
   '.zl-on-dark .zl-input::placeholder { color: rgba(255,255,255,.55); }\n' +
   '.zl-brand-field .zl-input::placeholder { color: rgba(11,13,13,.5); }'],
  ['.zl-on-dark .zl-input:focus, .zl-brand-field .zl-input:focus { border-bottom-color: #fff; }',
   '.zl-on-dark .zl-input:focus { border-bottom-color: #fff; }\n' +
   '.zl-brand-field .zl-input:focus { border-bottom-color: var(--ink); }'],

  // --- buttons -------------------------------------------------------------
  ['.zl-btn--brand { --btn-fg: #fff; --btn-bg: var(--tiffany); --btn-bd: var(--tiffany); --btn-hover-bg: var(--ink); }',
   '/* Ink on turquoise (8.08:1), not white (2.41:1). This is the hero CTA and the\n' +
   '   waitlist submit — the two things that must never be hard to read. */\n' +
   '.zl-btn--brand { --btn-fg: var(--ink); --btn-bg: var(--tiffany); --btn-bd: var(--tiffany); --btn-hover-bg: var(--ink); }\n' +
   '.zl-btn--brand:hover { color: #fff; }'],
  ['.zl-btn--on-brand { --btn-fg: var(--tiffany); --btn-bg: #fff; --btn-bd: #fff; --btn-hover-bg: var(--ink); }',
   '/* On a turquoise field: white fill, ink label. Turquoise-on-white was 2.41:1. */\n' +
   '.zl-btn--on-brand { --btn-fg: var(--ink); --btn-bg: #fff; --btn-bd: #fff; --btn-hover-bg: var(--ink); }\n' +
   '.zl-btn--on-brand:hover { color: #fff; }'],

  // --- turquoise TEXT on light surfaces -> the deep variant -----------------
  ['.zl-product__idx { position: absolute; top: 1.125rem; left: 1.125rem; z-index: 1; font-size: .6875rem; letter-spacing: .2em; color: var(--tiffany); }',
   '.zl-product__idx { position: absolute; top: 1.125rem; left: 1.125rem; z-index: 1; font-size: .6875rem; letter-spacing: .2em; color: var(--tiffany-deep); }'],
  ['.zl-index-rule__num { font-size: var(--t-eyebrow); letter-spacing: .28em; color: var(--tiffany); }',
   '.zl-index-rule__num { font-size: var(--t-eyebrow); letter-spacing: .28em; color: var(--tiffany-deep); }\n' +
   '.zl-dark .zl-index-rule__num, .zl-brand-field .zl-index-rule__num { color: inherit; opacity: .7; }'],
];

let applied = 0, missed = [];
for (const [from, to] of EDITS) {
  if (css.includes(from)) { css = css.split(from).join(to); applied++; }
  else missed.push(from.slice(0, 60));
}

// .zl-num is turquoise display type on light — 2.31:1, fails even large-text.
css = css.replace(
  /(\.zl-num \{[^}]*?)color: var\(--tiffany\);/,
  '$1color: var(--tiffany-deep);'
);

fs.writeFileSync(CSS, css);
console.log(`applied ${applied}/${EDITS.length} contrast edits`);
if (missed.length) missed.forEach((m) => console.log(`  ! not found: ${m}…`));
console.log(css === before ? '  (no change written)' : '  written');
