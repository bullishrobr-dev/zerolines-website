const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(ROOT, 'assets')).filter(f => /\.(webp|png)$/.test(f)).sort();
const groups = { hero_model: [], atmosphere: [], product: [], story: [], science: [], logo: [], other: [] };
for (const f of files) {
  if (/^hero-model/.test(f)) groups.hero_model.push(f);
  else if (/^atmosphere/.test(f)) groups.atmosphere.push(f);
  else if (/^logo/.test(f)) groups.logo.push(f);
  else if (/^product|^hero-product|^hero-syringe|^hero-serum|^hero-peeling/.test(f)) groups.product.push(f);
  else if (/^story/.test(f)) groups.story.push(f);
  else if (/^science/.test(f)) groups.science.push(f);
  else groups.other.push(f);
}
let h = `<style>body{background:#111;color:#eee;font:12px system-ui;margin:0;padding:16px}
h2{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#79b;margin:22px 0 8px;border-bottom:1px solid #333;padding-bottom:4px}
.g{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.c{background:#1a1a1a}.c img{width:100%;height:150px;object-fit:cover;display:block}
.c span{display:block;padding:3px 4px;font-size:9px;color:#8c8c8c;word-break:break-all}</style>`;
for (const [k, v] of Object.entries(groups)) {
  if (!v.length) continue;
  h += `<h2>${k.replace('_', ' ')} (${v.length})</h2><div class="g">`;
  for (const f of v) h += `<div class="c"><img src="/assets/${f}"><span>${f}</span></div>`;
  h += `</div>`;
}
fs.writeFileSync(path.join(ROOT, '.claude/contactsheet.html'), h);
console.log('wrote contact sheet with', files.length, 'images');
