/* Palette v3 — refine the brand colour rather than shout it.
 *
 * Owner feedback: "the Tiffany Turquoise colour looks absolutely horrible on the
 * page. It does not look refined."
 *
 * Diagnosis: #0ABAB5 is not wrong as an identity, it was wrong as a SURFACE.
 * Tiffany uses that colour on physical objects — a box, a ribbon — against
 * white, at small scale. At full-bleed on screen it is a high-chroma cyan that
 * reads wellness-app, and it fights the warm skin tones the photography lives in.
 * The brand's own packaging already disagrees with it: the peeling gel and day
 * cream bottles are a softer, greener sea-teal.
 *
 * v3 therefore:
 *   - large brand areas move to HOUSE TEAL #1F4F4A (depth instead of chroma).
 *     Light text on it measures 8.05:1, so brand sections can be dark and
 *     elegant rather than the black-on-bright they were forced into.
 *   - the turquoise survives as SIGNAL #4FB3AC — rules, ticks, underlines,
 *     focus rings. Lines and marks only, NEVER text: it is 2.35:1 on alabaster.
 *   - surfaces warm slightly to ALABASTER #FAF7F2 to sit with the photography.
 *   - CHAMPAGNE #C2A878 joins as the metallic that actually signals luxury.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'assets', 'zl.css');

let css = fs.readFileSync(CSS, 'utf8');
const before = css;

// ---- tokens --------------------------------------------------------------
const TOKENS = [
  ['--bone:        #FBFAF8;', '--bone:        #FAF7F2;'],
  ['--bone-2:      #F4F1EC;', '--bone-2:      #F2EDE5;'],
  ['--bone-3:      #EBE6DE;', '--bone-3:      #E7E0D5;'],
  ['--ink:         #0B0D0D;', '--ink:         #14181A;'],
  ['--ink-2:       #1F2222;', '--ink-2:       #262B2C;'],
  ['--ink-3:       #474B4B;', '--ink-3:       #3C4142;'],
  ['--mist:        #6B6F6C;', '--mist:        #6B706D;'],
];
for (const [from, to] of TOKENS) css = css.split(from).join(to);

// Replace the brand block wholesale
css = css.replace(
  /  \/\* THE BRAND — Tiffany turquoise \*\/[\s\S]*?--tiffany-wash: #E8F8F7;.*?\n/,
  `  /* THE BRAND
     House teal carries large areas; signal is the turquoise mark. */
  --house:        #1F4F4A;   /* full-bleed brand sections, buttons, teal text */
  --house-deep:   #12332F;   /* deeper field where two teals meet */
  --house-lift:   #2C6A63;   /* hover */
  --signal:       #4FB3AC;   /* RULES AND MARKS ONLY — 2.35:1, never set text in it */
  --sage-wash:    #E8EFEC;   /* tint surface */

  /* Back-compat aliases so existing rules keep resolving */
  --tiffany:      var(--signal);
  --tiffany-lift: #6FC7C0;
  --tiffany-deep: var(--house);
  --tiffany-ink:  var(--house-deep);
  --tiffany-wash: var(--sage-wash);
`
);

// Champagne replaces the old gold
css = css.split('--gold:        #A98C54;').join('--champagne:    #C2A878;\n  --gold:        #C2A878;');
css = css.split('--gold-lift:   #C6A874;').join('--gold-lift:   #D4BE94;');

// ---- brand field: light type on a deep field ------------------------------
css = css.replace(
  /\.zl-brand-field \{ background: var\(--tiffany\); color: var\(--ink\); \}/,
  '.zl-brand-field { background: var(--house); color: var(--on-dark); }'
);
css = css.replace(
  /\.zl-brand-field h1, \.zl-brand-field h2, \.zl-brand-field h3 \{ color: var\(--ink\); \}/,
  '.zl-brand-field h1, .zl-brand-field h2, .zl-brand-field h3 { color: var(--on-dark); }'
);

// every descendant rule that forced ink onto the old bright field flips back to light
const FIELD = [
  ['.zl-brand-field .zl-em--brand { color: var(--ink); }',
   '.zl-brand-field .zl-em--brand { color: var(--signal); }'],
  ['.zl-brand-field .zl-num,\n.zl-brand-field .zl-muted,\n.zl-brand-field dt,\n.zl-brand-field dd,\n.zl-brand-field p,\n.zl-brand-field li { color: var(--ink); }',
   '.zl-brand-field .zl-num,\n.zl-brand-field dt,\n.zl-brand-field p,\n.zl-brand-field li { color: var(--on-dark); }'],
  ['.zl-brand-field .zl-muted, .zl-brand-field dd { color: rgba(11,13,13,0.78); }',
   '.zl-brand-field .zl-muted, .zl-brand-field dd { color: var(--on-dark-2); }'],
  ['.zl-brand-field .zl-eyebrow { color: rgba(11,13,13,0.8); }  /* 0.66 measured 4.3:1 */',
   '.zl-brand-field .zl-eyebrow { color: rgba(255,255,255,0.78); }'],
  ['.zl-brand-field .zl-eyebrow::before { background: rgba(11,13,13,0.7); }',
   '.zl-brand-field .zl-eyebrow::before { background: var(--signal); }'],
  ['.zl-brand-field .zl-lead { color: rgba(11,13,13,0.82); }',
   '.zl-brand-field .zl-lead { color: rgba(255,255,255,0.9); }'],
  ['.zl-brand-field .zl-form__note { color: rgba(11,13,13,0.72); }',
   '.zl-brand-field .zl-form__note { color: rgba(255,255,255,0.76); }'],
  ['.zl-brand-field .zl-form__status[data-state="ok"] { color: var(--ink); }',
   '.zl-brand-field .zl-form__status[data-state="ok"] { color: var(--signal); }'],
  ['.zl-brand-field .zl-link:hover { color: var(--ink); }',
   '.zl-brand-field .zl-link:hover { color: var(--signal); }'],
  ['.zl-brand-field .zl-input { color: var(--ink); border-bottom-color: rgba(11,13,13,.3); }',
   '.zl-brand-field .zl-input { color: #fff; border-bottom-color: rgba(255,255,255,.34); }'],
  ['.zl-brand-field .zl-input::placeholder { color: rgba(11,13,13,.5); }',
   '.zl-brand-field .zl-input::placeholder { color: rgba(255,255,255,.55); }'],
  ['.zl-brand-field .zl-input:focus { border-bottom-color: var(--ink); }',
   '.zl-brand-field .zl-input:focus { border-bottom-color: var(--signal); }'],
  ['.zl-brand-field .zl-btn--on-dark-ghost { --btn-fg: var(--ink); --btn-bd: rgba(11,13,13,.45); }',
   '.zl-brand-field .zl-btn--on-dark-ghost { --btn-fg: var(--on-dark); --btn-bd: rgba(255,255,255,.45); }'],
  ['.zl-brand-field .zl-btn--on-dark-ghost:hover { color: #fff; }',
   '.zl-brand-field .zl-btn--on-dark-ghost:hover { color: var(--house); }'],
  ['.zl-btn--on-brand { --btn-fg: var(--ink); --btn-bg: #fff; --btn-bd: #fff; --btn-hover-bg: var(--ink); }',
   '.zl-btn--on-brand { --btn-fg: var(--house); --btn-bg: var(--champagne); --btn-bd: var(--champagne); --btn-hover-bg: #fff; }'],
  ['.zl-btn--on-brand-ghost { --btn-fg: var(--ink); --btn-bg: transparent; --btn-bd: rgba(11,13,13,.45); --btn-hover-bg: var(--ink); }',
   '.zl-btn--on-brand-ghost { --btn-fg: var(--on-dark); --btn-bg: transparent; --btn-bd: rgba(255,255,255,.45); --btn-hover-bg: #fff; }'],
  ['.zl-btn--on-brand-ghost:hover { color: #fff; border-color: var(--ink); }',
   '.zl-btn--on-brand-ghost:hover { color: var(--house); border-color: #fff; }'],
  ['.zl-btn--on-brand:hover { color: #fff; }',
   '.zl-btn--on-brand:hover { color: var(--house); }'],
  // primary CTA: house teal field, light label — 8.05:1
  ['.zl-btn--brand { --btn-fg: var(--ink); --btn-bg: var(--tiffany); --btn-bd: var(--tiffany); --btn-hover-bg: var(--ink); }',
   '.zl-btn--brand { --btn-fg: var(--on-dark); --btn-bg: var(--house); --btn-bd: var(--house); --btn-hover-bg: var(--ink); }'],
  ['.zl-btn--brand:hover { color: #fff; }', '.zl-btn--brand:hover { color: #fff; }'],
];
let applied = 0, missed = [];
for (const [from, to] of FIELD) {
  if (css.includes(from)) { css = css.split(from).join(to); applied++; }
  else missed.push(from.slice(0, 56));
}

// ::selection was white-on-signal
css = css.split('::selection { background: var(--tiffany); color: #fff; }')
         .join('::selection { background: var(--house); color: var(--on-dark); }');

fs.writeFileSync(CSS, css);
console.log(`palette v3 written — ${applied}/${FIELD.length} brand-field rules updated`);
if (missed.length) missed.forEach((m) => console.log(`  ! not found: ${m}…`));
console.log(css === before ? '  (no change)' : '  ok');
