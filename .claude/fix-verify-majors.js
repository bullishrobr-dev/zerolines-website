/* Close the five major findings from the content-pass verifiers.
 *
 * 1. /testimonials is an orphan — zero inbound links site-wide (it was dropped
 *    from the nav during the rebuild and nothing else points at it). It joins
 *    the footer Explore column on every page.
 * 2. Ten non-blog <title> tags run past 60 chars and get truncated in SERPs.
 *    The "| Step 0X ..." tails carry no search value — the product name and
 *    brand do the work.
 * 3./4. Two articles link the same product 3-4 times in prose. First body link
 *    stays, later duplicates are unwrapped to plain text. The site-wide
 *    "Explore Zero Lines" component block keeps its link — it is navigation,
 *    and unwrapping it on one article would make that component inconsistent.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.claude', '.venv', '.netlify', 'assets', '_do-not-use'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

/* ---- 1. footer link to /testimonials/ ------------------------------------ */
let footered = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('href="/testimonials/"')) continue;   // already links it somewhere
  const before = html;
  html = html.replace(
    /(<a href="\/story\/">Story<\/a>)(\s*)(<a href="\/blog\/">Journal<\/a>)/,
    '$1$2<a href="/testimonials/">Testimonials</a>$2$3'
  );
  if (html !== before) { fs.writeFileSync(file, html); footered++; }
}
console.log(`footer Testimonials link added on ${footered} page(s)`);

/* ---- 2. titles under 60 chars -------------------------------------------- */
const TITLES = {
  'science/index.html': 'The Science of Skin Longevity — Zero Lines',
  'protocol/index.html': 'The Longevity Protocol — Zero Lines',
  'faq.html': 'Questions & Answers — Zero Lines',
  'analyser/index.html': 'Skin Analyser — Zero Lines',
  'products/serum/index.html': 'BioSignal Facial Serum — Zero Lines',
  'products/syringe/index.html': 'Precision Collagen Activation Syringe — Zero Lines',
  'products/syringe-refill/index.html': 'Precision Collagen Activation Refill — Zero Lines',
  'products/day-cream/index.html': 'Environmental Shield Day Cream — Zero Lines',
  'products/night-cream/index.html': 'Renewal & Repair Night Cream — Zero Lines',
  'products/peeling-gel/index.html': 'Bio-Renewal Peeling Gel — Zero Lines',
};
let titled = 0;
for (const [rel, title] of Object.entries(TITLES)) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  const esc = title.replace(/&/g, '&amp;');
  const next = html.replace(/<title>[^<]*<\/title>/, `<title>${esc}</title>`);
  if (next !== html) { fs.writeFileSync(file, next); titled++; }
  if (esc.length > 60) console.log(`  ! still long (${esc.length}): ${rel}`);
}
console.log(`titles shortened on ${titled} page(s)`);

/* ---- 3./4. de-duplicate prose links -------------------------------------- */
function unwrapNth(file, href, keepFirst) {
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // only unwrap links inside <p>/<li> body content, leave the Explore component
  // (identifiable by its class on the wrapping block) untouched
  const re = new RegExp('<a href="' + href.replace(/[/\\-]/g, '\\$&') + '"[^>]*>([^<]+)</a>', 'g');
  let seen = 0, changed = 0;
  html = html.replace(re, (m, text, offset) => {
    // is this occurrence inside the Explore component? walk back a little
    const context = html.slice(Math.max(0, offset - 600), offset);
    const inExplore = /zl-blog-explore|Explore Zero Lines/.test(context);
    if (inExplore) return m;
    seen++;
    if (seen <= keepFirst) return m;
    changed++;
    return text;
  });
  fs.writeFileSync(path.join(ROOT, file), html);
  return changed;
}

const a = unwrapNth('blog/hydrolyzed-collagen-myth-miracle.html', '/products/syringe/', 1);
const b = unwrapNth('blog/morning-vs-night-routine.html', '/products/night-cream/', 1);
console.log(`unwrapped duplicate prose links: hydrolyzed-collagen ${a}, morning-vs-night ${b}`);
