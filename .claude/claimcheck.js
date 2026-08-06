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
  /* Everything below was found live, in structured data this linter could not
     see, on the day the JSON-LD scan was added. Each is here so that the exact
     sentence cannot come back. */
  // "suitable for rosacea, acne and sensitive skin" — a cosmetic may not be
  // offered as appropriate treatment for a named condition.
  [/\b(suitable|recommended|indicated|effective)\s+(for|against)\s+[^.;]{0,40}\b(acne|eczema|rosacea|psoriasis|dermatitis|melasma)\b/i, 'offered as suitable for a named condition'],
  // "without the thinning that corticosteroids cause" — a FAVOURABLE COMPARISON
  // to a prescription medicine. Naming one while explaining the category is
  // ordinary science writing: "prescription retinoids (tretinoin) increase
  // collagen synthesis" is a fact about a class this house does not sell. A
  // bare name-match flagged that, so the comparison has to be in the pattern.
  [/\b(unlike|without the|better than|as effective as|instead of|rivals?|outperforms?|compared (?:to|with))\s+[^.;]{0,50}\b(corticosteroid|hydrocortisone|tretinoin|isotretinoin)s?\b/i, 'favourable comparison to a prescription medicine'],
  // "Most users notice improved hydration within 7-14 days" — a consumer-panel
  // result for a range that has never been sold to a consumer.
  [/\b(most|many|\d{1,3}\s?%\s+of)\s+(users|customers|clients|women|men)\s+(notice|report|see|experience|say)/i, 'consumer-panel result'],
  // "Structural changes in collagen density become measurable after 8-12 weeks"
  [/\bbecomes?\s+measurable\b|\bmeasurable\s+(changes?|improvements?|results?|increase)/i, 'promise of a measurable physiological change'],
  // A HowTo step told search engines the day cream "adds mineral UV protection".
  // It carries no SPF, and its own page says so four times.
  [/\b(adds?|provides?|offers?|delivers?|gives?)\s+(\w+\s+){0,2}(UV|sun)\s+protection\b/i, 'sun-protection claim'],
];

// Acceptable when the site is explaining the category; not acceptable in the
// brand's own promotional voice.
const SOFT = [
  // Requires the "of" that turns a number into a share of an outcome. Without
  // it this fired on "The 1% Line", which is the INCI ordering rule and exactly
  // the kind of false positive that gets a linter switched off.
  [/\b\d{1,3}\s?%\s+of\s+(visible\s+)?(ageing|aging|damage|wrinkles|fine lines)/i, 'efficacy percentage in a headline'],
  [/\btransformative\b/i, 'unsupportable efficacy adjective'],
  [/\bproven\b/i, 'substantiation claim'],
  [/\bguarantee[sd]?\b/i, 'guarantee'],
  [/\bmiracle\b/i, 'miracle claim'],
  [/\bdramatic(ally)?\b/i, 'overstated magnitude'],
  [/\bmedical[-\s]?grade\b/i, 'implies regulated status'],
  /* SOFT rather than HARD, deliberately. "Oestrogen levels directly stimulate
     collagen synthesis" and "growth hormone released during deep sleep
     stimulates collagen synthesis" are statements about human biology inside
     educational articles, and as a hard rule this flagged four of them. In the
     brand's own voice — a heading, a meta description, a product page — the
     same words stop describing biology and start claiming what Zero Lines does. */
  [/\bstimulates?\s+collagen\s+(synthesis|production)\b/i, 'physiological-action claim in brand voice'],
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
  // "Guaranteed results" is a claim about what a product does. A satisfaction or
  // money-back guarantee is a term of sale, and a linter that forbids the brand
  // from offering one has wandered out of claims and into the returns policy.
  if (/\b(satisfaction|money[- ]back|refund|returns?)\s*$/i.test(before)) return 'commercial guarantee, not efficacy';
  /* A physiological verb is only a claim when the thing doing it is ours.
     "Oestrogen levels directly stimulate collagen synthesis" and "growth
     hormone released during deep sleep stimulates collagen synthesis" describe
     the reader's own body, in articles about ageing and about sleep. Flagging
     them asks the house to stop explaining how skin works, which is the one
     thing the journal exists to do. */
  if (/\b(oestrogen|estrogen|hormones?|growth hormone|menopause|sleep|exercise|fibroblasts?|retinoids?|retinol|tretinoin|vitamin\s*c|microneedling|the\s+body|your\s+body)\b[^.;]{0,60}$/i.test(before)) {
    return 'subject is the body or a third-party category, not a Zero Lines formulation';
  }
  return null;
}

// Where the brand speaks in its own promotional voice. A SOFT hit here fails.
const BRAND_VOICE = [
  /<h[12]\b[^>]*>[\s\S]*?<\/h[12]>/gi,
  // Journal headlines are brand voice too. "SPF Every Day: The Habit That
  // Prevents 80% of Visible Ageing" ran as an H1 and across six other pages,
  // and this linter passed it because it was only reading product copy.
  /<h[1-3]\b[^>]*class="[^"]*(?:blog|article)[^"]*"[^>]*>[\s\S]*?<\/h[1-3]>/gi,
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

/* ---------------------------------------------------------------------------
   Structured data.

   strip() above deletes every <script> block before anything is scanned, which
   meant no JSON-LD on any of the 52 pages had ever been read by this linter.
   That is precisely where the claims removed from the visible copy were still
   living: "80% of visible ageing" and the retinoid "only proven" line survived
   in the markup of the page they had been deleted from; a HowTo step told
   Google the day cream adds "mineral UV protection" when its own product page
   says four times that it carries no SPF.

   JSON-LD is not an implementation detail. It is the brand asserting things in
   public, under its own name, in the form search engines quote. It is brand
   voice, so SOFT claims fail here exactly as they do in an H1.
   --------------------------------------------------------------------------- */
const LD_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function ldStrings(source) {
  const out = [];
  LD_BLOCK.lastIndex = 0;
  let m;
  while ((m = LD_BLOCK.exec(source)) !== null) {
    const line = lineOf(source, m.index);
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch (e) {
      // Unparseable is its own problem, but scan the raw text rather than
      // silently skipping the block — a broken block still ships to crawlers.
      out.push({ line, s: m[1] });
      continue;
    }
    const walk = (n) => {
      if (typeof n === 'string') {
        // URLs and enum-ish @type values carry no claims and produce noise.
        if (!/^(https?:|\/|#)/.test(n) && n.length > 12) out.push({ line, s: n });
        return;
      }
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === 'object') return Object.values(n).forEach(walk);
    };
    walk(parsed);
  }
  return out;
}

const hits = [];

for (const file of walk(ROOT)) {
  const source = fs.readFileSync(file, 'utf8');
  const raw = strip(source);
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

  // Structured data — every string the page publishes to machines. Both tiers
  // apply: there is no editorial register here, only assertion.
  for (const { line, s } of ldStrings(source)) {
    for (const [re, why] of HARD) {
      const g = new RegExp(re.source, 'gi');
      let m;
      while ((m = g.exec(s)) !== null) {
        if (excused(s, m.index, m.index + m[0].length)) continue;
        hits.push({ file: rel, severity: 'hard', why, match: m[0].trim(), where: 'structured data', line });
        break;
      }
    }
    for (const [re, why] of SOFT) {
      const g = new RegExp(re.source, 'gi');
      const m = g.exec(s);
      if (!m || excused(s, m.index, m.index + m[0].length)) continue;
      hits.push({ file: rel, severity: 'soft', why, match: m[0].trim(), where: 'structured data', line });
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
