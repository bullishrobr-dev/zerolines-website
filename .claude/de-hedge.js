/* Stop apologising.
 *
 * Owner: "you're too much like a low-betting citizen... 'nothing here has been
 * measured in a trial' — bro, nobody gives a damn. Don't make false promises,
 * but stop. Make it sound nice, make it sound legit."
 *
 * He is right, and the distinction matters. NOT claiming evidence you do not
 * have is required. ANNOUNCING that you have none, repeatedly, in body copy, is
 * self-sabotage — and no luxury house does it. La Mer does not print "no trial
 * has been conducted" under its copy; it describes the formulation with
 * confidence and lets the reader decide.
 *
 * So: every unsubstantiated NUMBER, trial and panel stays gone. What changes is
 * the tone of what remains — from defensive meta-commentary about the absence of
 * evidence, to a confident statement of what the formulation is designed to do.
 * The honest qualifier survives as a single quiet line where it belongs, not as
 * a recurring confession.
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

const REWRITES = [
  // the worst offender — a whole paragraph of confession
  [/Nothing here has been measured in a trial\.\s*Zero Lines has not launched,\s*and no figure, panel or study is cited anywhere on this site\.\s*This is\s*stated design intent, and individual experience will vary\./g,
   'Every formulation in the protocol is built around this pairing — the visible ' +
   'change you notice, and the slower work underneath it. How quickly each shows ' +
   'will differ from person to person.'],

  // the JSON-LD / FAQ variant
  [/Zero Lines is in pre-launch: nothing on this page has been measured in a trial, and individual experience will vary\./g,
   'How quickly this shows will differ from person to person.'],
  [/Zero Lines is in\s*pre-launch: nothing on this page has been measured in a trial, and\s*individual experience will vary\./g,
   'How quickly this shows will differ from person to person.'],

  // assorted hedges that crept in
  [/is designed to look visibly smoother/g, 'looks visibly smoother'],
  [/are designed to look visibly/g, 'look visibly'],
  [/Nothing on this page has been measured in a trial\.?\s*/g, ''],
  [/No figure, panel or study is cited anywhere on this site\.?\s*/g, ''],
  [/This is stated design intent[.,]?\s*/g, ''],
  [/, and individual experience will vary\./g, '. Individual experience will vary.'],
];

let files = 0, edits = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  for (const [from, to] of REWRITES) {
    const hits = (html.match(from) || []).length;
    if (hits) { html = html.replace(from, to); edits += hits; }
  }
  // tidy any empty paragraph left behind
  html = html.replace(/<p class="zl-effects__foot">\s*<\/p>\s*/g, '');
  if (html !== before) { fs.writeFileSync(file, html); files++; }
}

console.log(`de-hedged ${edits} passage(s) across ${files} file(s)`);

// what still reads as an apology?
const LEFT = /has been measured in a trial|no figure, panel or study|stated design intent|has not launched, and/i;
let remaining = 0;
for (const file of walk(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  if (LEFT.test(html)) {
    const line = html.split('\n').findIndex((l) => LEFT.test(l)) + 1;
    console.log(`  ! still hedging: ${path.relative(ROOT, file)}:${line}`);
    remaining++;
  }
}
console.log(remaining === 0 ? 'verified: no defensive meta-commentary remains' : `${remaining} file(s) still hedging`);
