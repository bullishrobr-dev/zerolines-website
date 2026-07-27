/* Follow-up cleanups after the Netlify Forms conversion:
 *   1. Remove the duplicated method="POST" my first pass left in form tags.
 *   2. Strip stale "TODO: Replace FORM_ID..." comments.
 *   3. Rewrite the waitlist JS handler to POST to Netlify instead of Formspree,
 *      and — importantly — stop reporting success before the request resolves.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.claude', '.venv', '.netlify', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

let cleaned = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // 1. collapse the duplicate method attribute inside <form ...> tags only
  html = html.replace(/<form([^>]*)>/g, (m, attrs) => {
    let seen = false;
    const fixed = attrs.replace(/\s*method="POST"/gi, () => {
      if (seen) return '';
      seen = true;
      return ' method="POST"';
    }).replace(/\s{2,}/g, ' ');
    return `<form${fixed}>`;
  });

  // 2. stale TODO comments
  html = html.replace(/^\s*<!--\s*TODO: Replace FORM_ID[^>]*-->\s*\n/gm, '');
  html = html.replace(/^\s*\/\/ TODO: Replace FORM_ID.*\n/gm, '');

  if (html !== before) { fs.writeFileSync(file, html); cleaned++; }
}
console.log(`cleaned form markup in ${cleaned} file(s)`);

// 3. Rewrite the waitlist submit handler in index.html
const idx = path.join(ROOT, 'index.html');
let html = fs.readFileSync(idx, 'utf8');

const OLD_START = "        // Show success state immediately (optimistic)";
const OLD_END = "      };\n      window.zlSubmitNewsletter";

const s = html.indexOf(OLD_START);
const e = html.indexOf(OLD_END);
if (s === -1 || e === -1) {
  console.log('! could not locate the waitlist handler — leaving index.html JS untouched');
} else {
  const replacement = `        var statusEl = form.querySelector('.zl-form__status');
        var btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

        // Netlify Forms accepts a urlencoded POST to any path on the site.
        // Report success only once the request actually resolves — the previous
        // build showed "Welcome to the waitlist" optimistically and swallowed
        // every failure, which is why a dead endpoint went unnoticed for months.
        var body = new URLSearchParams({
          'form-name': 'waitlist',
          email: email,
          source: source || 'waitlist'
        }).toString();

        return fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          form.innerHTML = '<p class="zl-form__status" data-state="ok">Welcome to the waitlist. We\\'ll be in touch.</p>';
          if (typeof gtag === 'function') gtag('event', 'waitlist_signup');
          return r;
        }).catch(function (err) {
          console.warn('Waitlist submission failed:', err);
          if (btn) { btn.disabled = false; btn.textContent = 'Notify Me'; }
          if (statusEl) {
            statusEl.setAttribute('data-state', 'err');
            statusEl.textContent = 'Something went wrong. Please email info@zerolines.life and we will add you.';
          }
          throw err;
        });
`;
  html = html.slice(0, s) + replacement + html.slice(e);
  fs.writeFileSync(idx, html);
  console.log('rewrote the waitlist handler to POST to Netlify Forms');
}

// verify
const all = walk(ROOT).map((f) => [f, fs.readFileSync(f, 'utf8')]);
const stillFormspree = all.filter(([, h]) => /formspree/i.test(h)).map(([f]) => path.relative(ROOT, f));
const dupMethod = all.filter(([, h]) => /<form[^>]*method="POST"[^>]*method="POST"/i.test(h)).map(([f]) => path.relative(ROOT, f));
console.log(`\nformspree references remaining: ${stillFormspree.length}${stillFormspree.length ? ' -> ' + stillFormspree.join(', ') : ''}`);
console.log(`duplicate method attrs remaining: ${dupMethod.length}`);
const netlifyForms = all.reduce((n, [, h]) => n + (h.match(/<form[^>]*data-netlify/g) || []).length, 0);
console.log(`netlify forms in place: ${netlifyForms}`);
