/* Cosmetic-claim linter for the live copy.
 *
 * Zero Lines sells appearance, not treatment. Under EU/UK Reg. 655/2013 a
 * cosmetic claim has to be supportable, and this brand has no completed study,
 * no panel and no product in existence yet — so any efficacy claim on a product
 * page is unsupportable by definition, however good it sounds.
 *
 * The failure this catches is not someone writing "clinically proven" on
 * purpose. It is a headline like "Transformative results", which reads as
 * ordinary marketing, sat in an h2 on the flagship product page, and survived a
 * full rewrite because nobody was looking for it.
 *
 * Two lists. HARD is never acceptable in the brand's own voice. SOFT is
 * acceptable in editorial about the wider category — an article explaining that
 * retinoids are among the most proven anti-ageing ingredients is a statement
 * about retinoids, not a Zero Lines claim — but is a failure inside a product
 * page, a hero, or a meta description, where the voice is the brand's own.
 *
 * Usage: node .claude/claimcheck.js [--json]
 * Exits non-zero if any HARD hit, or any SOFT hit in brand voice.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const HARD = [
  [/\bclinically\s+(proven|tested|validated)\b/i, 'clinical substantiation claim'],
  [/\bdermatologist[-\s]?(approved|tested|recommended)\b/i, 'professional endorsement claim'],
  [/\b(eliminates?|erases?|removes?)\s+(the\s+|your\s+)?(wrinkles?|lines?|ageing|aging)\b/i, 'removal-of-wrinkles claim'],
  // "treats" only in its medicinal sense — against a named condition. The verb
  // also means "regards", and the site uses it that way on purpose ("we treat
  // skin as a living system"), so a bare "treats skin" must not fire.
  [/\b(cures?|heals?|treats?)\s+(the\s+|your\s+)?(acne|eczema|rosacea|psoriasis|dermatitis|inflammation|a\s+condition)\b/i, 'medicinal claim'],
  [/\bpermanent(ly)?\s+(results?|smooth|younger|reduction|change\s+to\s+(the\s+)?skin)/i, 'permanence claim'],
  [/\b\d{1,3}\s?%\s*(of\s+)?(users|women|participants|reduction|improvement|smoother|firmer)/i, 'efficacy percentage'],
  [/\breverses?\s+(ageing|aging|time|the\s+clock)\b/i, 'reversal claim'],
  [/\banti[-\s]?wrinkle\b/i, 'wrinkle-treatment claim'],
  [/\bbotox[-\s]?(like|alternative|in\s+a)\b/i, 'comparison to a prescription medicine'],
  [/\bfiller[-\s]?(like|alternative)\b/i, 'comparison to a medical device'],
];

// Acceptable when the site is explaining the category; not acceptable in the
// brand's own promotional voice.
const SOFT = [
  [/\btransformative\b/i, 'unsupportable efficacy adjective'],
  [/\bproven\b/i, 'substantiation claim'],
  [/\bguarantee[sd]?\b/i, 'guarantee'],
  [/\bmiracle\b/i, 'miracle claim'],
  [/\bdramatic(ally)?\b/i, 'overstated magnitude'],
  [/\bmedical[-\s]?grade\b/i, 'implies regulated status'],
];

/* The site under-claims on purpose — "No single morning is dramatic", "We do not
 * claim to erase time", "not a miracle cure" — and an article is titled
 * "Hydrolysed Collagen: Myth or Miracle?", which poses the question in order to
 * answer no. Every one of those is the copy doing exactly the right thing, so a
 * linter that flags them is a linter nobody runs. Look back a short window for a
 * negation, and forward for the question mark that makes a headline a question.
 */
const NEGATED = /\b(no|not|nothing|never|n[o']t|without|hardly|rarely|isn|aren|doesn|don|won|cannot|can)\b[^.;:!?]{0,44}$/i;
const RHETORICAL = /^[^.;!?]{0,30}\?/;

function excused(body, start, end) {
  const before = body.slice(Math.max(0, start - 90), start);
  if (NEGATED.test(before)) return 'negated';
  if (RHETORICAL.test(body.slice(end, end + 34))) return 'rhetorical question';
  // "myth or miracle" / "miracle or myth" is the title of a debunking article.
  const around = body.slice(Math.max(0, start - 24), end + 24).toLowerCase();
  if (/\bmyth\b[\s\S]{0,12}\bmiracle\b|\bmiracle\b[\s\S]{0,12}\bmyth\b/.test(around)) return 'debunking headline';
  return null;
}

// Where the brand speaks in its own promotional voice. A SOFT hit here fails.
const BRAND_VOICE = [
  /<h[12]\b[^>]*>[\s\S]*?<\/h[12]>/gi,
  /<meta\s+[^>]*(?:name|property)=["'](?:description|og:description|og:title|twitter:description|twitter:title)["'][^>]*>/gi,
  /<title\b[^>]*>[\s\S]*?<\/title>/gi,
  /<[^>]*class=["'][^"']*zl-(?:hero|eyebrow|display|lede)[^"']*["'][^>]*>[\s\S]{0,400}?<\//gi,
];

const SKIP_DIRS = ['.git', 'node_modules', '.venv', '.netlify', '.claude', '_do-not-use'];
// terms.html and privacy.html must be able to say "not intended to cure".
const SKIP_FILES = ['terms.html', 'privacy.html', 'cookies.html'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !SKIP_FILES.includes(e.name)) out.push(p);
  }
  return out;
}

const strip = (s) => s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ');
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

const hits = [];

for (const file of walk(ROOT)) {
  const raw = strip(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(ROOT, file);
  const isProduct = rel.startsWith('products/') || rel === 'index.html';

  const body = text(raw);
  for (const [re, why] of HARD) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(body)) !== null) {
      if (excused(body, m.index, m.index + m[0].length)) continue;
      hits.push({ file: rel, severity: 'hard', why, match: m[0].trim(), where: 'anywhere' });
      break;
    }
  }

  // Collect the brand-voice regions once, with their offsets, so a SOFT hit can
  // be attributed to a line rather than just to a file.
  const regions = [];
  for (const re of BRAND_VOICE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) regions.push({ s: m.index, t: text(m[0]) });
  }

  for (const [re, why] of SOFT) {
    let flagged = false;
    for (const r of regions) {
      const m = r.t.match(re);
      if (!m || excused(r.t, m.index, m.index + m[0].length)) continue;
      hits.push({
        file: rel, severity: 'soft', why, match: m[0].trim(),
        where: 'brand voice', line: lineOf(raw, r.s),
      });
      flagged = true;
      break;
    }
    // A soft claim in body copy on a product page is still the brand's voice.
    if (!flagged && isProduct) {
      const g = new RegExp(re.source, 'gi');
      let m;
      while ((m = g.exec(body)) !== null) {
        if (excused(body, m.index, m.index + m[0].length)) continue;
        hits.push({ file: rel, severity: 'soft', why, match: m[0].trim(), where: 'product page copy' });
        break;
      }
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(hits, null, 1));
} else if (!hits.length) {
  console.log('claimcheck: clean — no unsupportable claims in brand voice');
} else {
  for (const h of hits) {
    const at = h.line ? `:${h.line}` : '';
    console.log(`${h.severity.toUpperCase().padEnd(4)} ${h.file}${at}  "${h.match}"  — ${h.why} (${h.where})`);
  }
  console.log(`\n${hits.length} to review.`);
}

process.exit(hits.length ? 1 : 0);
