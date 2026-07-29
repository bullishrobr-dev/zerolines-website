/* Convert every email-capture form from a dead Formspree placeholder to
 * Netlify Forms.
 *
 * Why Netlify Forms: the site already deploys to Netlify, and form handling
 * needs no account, no API key and no third-party service — Netlify parses the
 * deployed HTML for forms carrying data-netlify and provisions an endpoint.
 * That means this can be fixed tonight without waiting on a Formspree ID.
 *
 * Every form currently posts to formspree.io/f/FORM_ID_PLACEHOLDER (25 blog
 * pages) or /FORM_ID (index.html x2). Both are dead: every signup since launch
 * has silently failed.
 *
 * Requirements Netlify imposes, all applied here:
 *   - a name= on the <form>
 *   - data-netlify="true"
 *   - a hidden input form-name matching the form's name (needed for JS submits)
 *   - netlify-honeypot for spam, paired with a visually-hidden field
 * The action points at a real /thank-you/ page so submission works with zero JS.
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

const HONEYPOT = '<p class="zl-hp" aria-hidden="true"><label>Do not fill this in: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>';

let filesChanged = 0, formsFixed = 0;
const detail = [];

for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  let n = 0;

  html = html.replace(/<form([^>]*?)action="https:\/\/formspree\.io\/f\/[^"]*"([^>]*)>/g, (_m, pre, post) => {
    n++;
    const attrs = (pre + post).trim();
    // Name the form by intent so submissions land in separate Netlify inboxes.
    const isWaitlist = /waitlist/i.test(attrs);
    const formName = isWaitlist ? 'waitlist' : 'newsletter';
    // Drop any inline onsubmit that hid the form — it fired even when the POST failed,
    // which is exactly why these looked like they worked.
    const cleaned = attrs.replace(/\s*onsubmit="[^"]*"/g, '');
    return (
      `<form ${cleaned} name="${formName}" method="POST" action="/thank-you/" ` +
      `data-netlify="true" netlify-honeypot="bot-field">\n` +
      `          <input type="hidden" name="form-name" value="${formName}">\n` +
      `          ${HONEYPOT}`
    );
  });

  if (n) {
    fs.writeFileSync(file, html);
    filesChanged++;
    formsFixed += n;
    detail.push(`  ${path.relative(ROOT, file).padEnd(44)} ${n} form(s)`);
  }
}

detail.forEach((d) => console.log(d));
console.log(`\n${formsFixed} form(s) converted across ${filesChanged} file(s)`);

// Verify nothing still points at Formspree, and every converted form is well-formed.
let leftovers = 0, malformed = 0;
for (const file of walk(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  if (/formspree\.io/.test(html)) { console.log(`  ! formspree remains: ${path.relative(ROOT, file)}`); leftovers++; }
  for (const m of html.match(/<form[^>]*data-netlify[^>]*>/g) || []) {
    if (!/name="/.test(m)) { console.log(`  ! form missing name: ${path.relative(ROOT, file)}`); malformed++; }
  }
  // every netlify form needs its matching hidden form-name input
  const names = [...html.matchAll(/<form[^>]*name="([^"]+)"[^>]*data-netlify/g)].map((m) => m[1]);
  for (const nm of names) {
    if (!html.includes(`name="form-name" value="${nm}"`)) {
      console.log(`  ! missing hidden form-name for "${nm}": ${path.relative(ROOT, file)}`);
      malformed++;
    }
  }
}
console.log(leftovers === 0 && malformed === 0
  ? 'verified: no Formspree references remain; all forms well-formed'
  : `${leftovers} leftover(s), ${malformed} malformed`);
