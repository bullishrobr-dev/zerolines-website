/* Fix the 65 broken internal references the link check surfaced.
 *
 * Three distinct pre-existing defects:
 *
 * 1. science/ story/ protocol/ testimonials/ contact/ reference "./assets/..."
 *    and "cookies.html". From /science/index.html those resolve to
 *    /science/assets/... and /science/cookies.html — none of which exist. So
 *    the stylesheet AND the React bundle 404 on all five pages.
 *    This was invisible in production because the old "/* /index.html 200"
 *    catch-all answered those requests with the homepage HTML at status 200:
 *    the browser received HTML where it asked for CSS/JS, failed to parse it,
 *    and rendered the pages unstyled. Removing the catch-all made the failure
 *    honest; this makes it correct.
 *
 * 2. The 5 blog category pages point at blog-hero-*.jpg files that have never
 *    existed. Each card links to a real article, and every article has a
 *    working hero image — so take the image from the article being linked to.
 *
 * 3. Assorted .jpg references where only .webp exists.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// ---- 1. content pages: relative -> absolute ------------------------------
const SHELLS = ['science', 'story', 'protocol', 'testimonials', 'contact'];
let shellFixed = 0;
for (const dir of SHELLS) {
  const file = path.join(ROOT, dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  html = html.replace(/(["'(])\.\/assets\//g, '$1/assets/');
  // bare same-dir links to root-level legal pages
  html = html.replace(/(href=")(cookies|privacy|terms|accessibility|faq|shipping-returns|404)\.html(")/g, '$1/$2.html$3');
  // .jpg -> .webp where only webp exists
  html = html.replace(/\/assets\/([a-z0-9-]+)\.jpg/g, (m, b) =>
    fs.existsSync(path.join(ROOT, 'assets', b + '.webp')) ? `/assets/${b}.webp` : m);

  if (html !== before) { fs.writeFileSync(file, html); shellFixed++; }
}
console.log(`content pages fixed: ${shellFixed}`);

// ---- 2. blog category hero images ----------------------------------------
// Build slug -> real hero image by reading each article.
const blogDir = path.join(ROOT, 'blog');
const articleHero = {};
for (const f of fs.readdirSync(blogDir).filter((f) => f.endsWith('.html') && !f.startsWith('category-') && f !== 'index.html')) {
  const html = fs.readFileSync(path.join(blogDir, f), 'utf8');
  // first ../assets/*.webp reference in the document is the article hero
  const m = html.match(/\.\.\/assets\/([a-z0-9-]+\.webp)/);
  if (m) articleHero[f] = m[1];
}

let catFixed = 0, catRefs = 0, unmatched = [];
for (const f of fs.readdirSync(blogDir).filter((f) => f.startsWith('category-'))) {
  const file = path.join(blogDir, f);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Each card is an <a href="article.html"> containing an <img src="../assets/blog-hero-*.jpg">
  html = html.replace(
    /<a([^>]*?)href="([a-z0-9-]+\.html)"([^>]*)>([\s\S]{0,900}?)<\/a>/g,
    (whole, pre, slug, post, inner) => {
      const hero = articleHero[slug];
      if (!hero) return whole;
      const patched = inner.replace(/\.\.\/assets\/blog-hero-[a-z0-9-]+\.jpg/g, () => {
        catRefs++;
        return `../assets/${hero}`;
      });
      return `<a${pre}href="${slug}"${post}>${patched}</a>`;
    }
  );

  // anything still pointing at a non-existent blog-hero-*.jpg
  for (const m of html.matchAll(/\.\.\/assets\/(blog-hero-[a-z0-9-]+\.jpg)/g)) unmatched.push(`${f}: ${m[1]}`);

  if (html !== before) { fs.writeFileSync(file, html); catFixed++; }
}
console.log(`blog category pages fixed: ${catFixed} (${catRefs} hero image(s) repointed)`);
if (unmatched.length) console.log(`still unmatched: ${unmatched.join(', ')}`);

// ---- 3. analyser stray relative link -------------------------------------
const an = path.join(ROOT, 'analyser', 'index.html');
if (fs.existsSync(an)) {
  let html = fs.readFileSync(an, 'utf8');
  const before = html;
  html = html.replace(/(href=")(cookies|privacy|terms|accessibility|faq|shipping-returns)\.html(")/g, '$1/$2.html$3');
  if (html !== before) { fs.writeFileSync(an, html); console.log('analyser: legal links made absolute'); }
}
