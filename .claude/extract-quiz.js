/* Pull the quiz question definitions out of the legacy page verbatim so the new
 * analyser can be rebuilt without retyping (and mistyping) 10 questions and
 * their ~45 options. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'analyser', 'index.html'), 'utf8');

const start = html.indexOf('questions: [');
if (start === -1) { console.error('questions array not found'); process.exit(1); }

// walk brackets to find the matching close
let i = html.indexOf('[', start), depth = 0, end = -1;
for (let j = i; j < html.length; j++) {
  if (html[j] === '[') depth++;
  else if (html[j] === ']') { depth--; if (depth === 0) { end = j; break; } }
}
if (end === -1) { console.error('unbalanced array'); process.exit(1); }

const src = html.slice(i, end + 1);
let questions;
try {
  questions = eval('(' + src + ')');    // trusted local source, our own file
} catch (e) {
  console.error('could not parse:', e.message);
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, '.claude', 'quiz-questions.json'), JSON.stringify(questions, null, 2));
console.log(`extracted ${questions.length} questions`);
questions.forEach((q, n) => {
  console.log(`  ${n + 1}. [${q.id}]${q.multi ? ' (multi)' : ''} ${q.question} — ${(q.options || []).length} options`);
});
