/* Second contrast pass.
 *
 * a) REGRESSION I INTRODUCED: the previous pass rewrote every inline
 *    `color:#fff` to `color:var(--ink)` to fix white-on-turquoise. That also hit
 *    the cookie notice's "Learn more" link — which sits on the near-black
 *    .zl-cookie panel — producing ink-on-ink at 1:1. Inline colour is the wrong
 *    mechanism here: remove it and let a stylesheet rule own the colour, so the
 *    link is correct in whatever context the component is used.
 *
 * b) The page authors used raw var(--tiffany) for small text on light surfaces.
 *    #0ABAB5 on bone is 2.31:1 — it fails even the 3:1 large-text floor.
 *    --tiffany-deep (#06736F) is 5.46:1 and is what the token exists for.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.claude', '.venv', '.netlify', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

let cookieFixed = 0, tiffanyFixed = 0, files = 0;

for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // (a) strip inline colour from links inside the cookie notice
  html = html.replace(
    /(<div class="zl-cookie"[\s\S]*?<\/div>\s*<\/div>)/g,
    (block) => block.replace(/ style="color:var\(--ink\);text-decoration:underline"/g, '')
                    .replace(/ style="color:#fff;text-decoration:underline"/g, '')
  );

  // (b) inline turquoise text -> the deep variant.
  //     Only touches `color:` declarations, never background/border.
  html = html.replace(/color:\s*var\(--tiffany\)/g, () => { tiffanyFixed++; return 'color:var(--tiffany-deep)'; });

  if (html !== before) { fs.writeFileSync(file, html); files++; }
}

// Give the cookie link an explicit rule so it is right wherever the component lands.
const CSS = path.join(ROOT, 'assets', 'zl.css');
let css = fs.readFileSync(CSS, 'utf8');
if (!css.includes('.zl-cookie a {')) {
  css = css.replace(
    '.zl-cookie__actions { display: flex; gap: .625rem; }',
    '/* The notice sits on the near-black panel, so its link is light. Owned here\n' +
    '   rather than inline, so it stays correct wherever the component is used. */\n' +
    '.zl-cookie a { color: #fff; text-decoration: underline; text-underline-offset: .18em; }\n' +
    '.zl-cookie a:hover { color: var(--tiffany-lift); }\n' +
    '.zl-cookie__actions { display: flex; gap: .625rem; }'
  );
  fs.writeFileSync(CSS, css);
  cookieFixed = 1;
}

console.log(`inline turquoise text corrected: ${tiffanyFixed} occurrence(s) across ${files} file(s)`);
console.log(cookieFixed ? 'cookie link colour moved into the stylesheet' : 'cookie link rule already present');
