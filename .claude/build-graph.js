/* Build .claude/content-graph.json — one shared map of every page's topics,
 * headings and existing links, so the linking agents work from the same picture
 * instead of 25 agents each re-scanning 40 files.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const STOP = new Set(('the a an and or but of to in on for with your you our we is are what why how ' +
  'when where it its this that these those from as at by be not no do does can will should over ' +
  'under after before more most less least every each vs than then if about into out up down ' +
  'zero lines skin skincare guide complete').split(' '));

function keywords(text) {
  return [...new Set(
    text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  )];
}

function extract(file, urlPath) {
  const html = fs.readFileSync(file, 'utf8');
  const pick = (re) => (html.match(re) || [, ''])[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const all = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);

  const title = pick(/<title>([^<]*)<\/title>/);
  const desc = pick(/<meta name="description" content="([^"]*)"/);
  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h2s = all(/<h2[^>]*>([\s\S]*?)<\/h2>/g).slice(0, 12);

  const internalLinks = [...new Set(
    [...html.matchAll(/href="(\/[^"#][^"]*)"/g)].map((m) => m[1].split('?')[0])
      .filter((h) => !/\.(css|js|webp|png|jpg|xml|txt)$/.test(h))
  )];

  return {
    path: urlPath,
    file: path.relative(ROOT, file),
    title, description: desc, h1, h2s,
    keywords: keywords([title, h1, ...h2s].join(' ')),
    linksOut: internalLinks,
    words: (html.replace(/<script[\s\S]*?<\/script>/g, '').match(/<p[^>]*>[\s\S]*?<\/p>/g) || [])
      .join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
  };
}

const pages = [];

// blog articles + hubs
for (const f of fs.readdirSync(path.join(ROOT, 'blog')).filter((f) => f.endsWith('.html'))) {
  pages.push(extract(path.join(ROOT, 'blog', f), '/blog/' + (f === 'index.html' ? '' : f)));
}
// products
pages.push(extract(path.join(ROOT, 'products', 'index.html'), '/products/'));
for (const s of ['peeling-gel', 'syringe', 'serum', 'day-cream', 'night-cream', 'syringe-refill']) {
  pages.push(extract(path.join(ROOT, 'products', s, 'index.html'), '/products/' + s));
}
// content pages
for (const s of ['science', 'story', 'protocol', 'testimonials', 'contact']) {
  pages.push(extract(path.join(ROOT, s, 'index.html'), '/' + s));
}
for (const f of ['faq.html', 'index.html']) {
  pages.push(extract(path.join(ROOT, f), f === 'index.html' ? '/' : '/' + f));
}
pages.push(extract(path.join(ROOT, 'analyser', 'index.html'), '/analyser/'));

// inbound links, computed from outbound
for (const p of pages) {
  p.linksIn = pages.filter((q) => q !== p && q.linksOut.some((l) =>
    l.replace(/\/$/, '') === p.path.replace(/\/$/, '') ||
    l.replace(/\/$/, '') === p.path.replace(/\.html$/, '').replace(/\/$/, '')
  )).map((q) => q.path);
}

// candidate connections: shared keywords between article pairs
const articles = pages.filter((p) => p.path.startsWith('/blog/') && !p.path.includes('category-') && p.path !== '/blog/');
const suggestions = [];
for (const a of articles) {
  const scored = pages
    .filter((b) => b !== a && !b.path.includes('category-'))
    .map((b) => ({
      to: b.path,
      shared: a.keywords.filter((k) => b.keywords.includes(k)),
    }))
    .filter((s) => s.shared.length >= 2)
    .sort((x, y) => y.shared.length - x.shared.length)
    .slice(0, 8);
  suggestions.push({ from: a.path, candidates: scored });
}

const out = { generated: 'content-graph v1', pages, suggestions };
fs.writeFileSync(path.join(ROOT, '.claude', 'content-graph.json'), JSON.stringify(out, null, 1));

console.log(`graph: ${pages.length} pages`);
console.log(`orphans (no inbound links): ${pages.filter((p) => !p.linksIn.length).map((p) => p.path).join(', ') || 'none'}`);
const avg = (articles.reduce((n, a) => n + a.linksOut.filter((l) => l.startsWith('/blog/') && !l.includes('category')).length, 0) / articles.length).toFixed(1);
console.log(`avg article->article links today: ${avg}`);
