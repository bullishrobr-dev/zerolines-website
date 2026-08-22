/**
 * Zero Lines — Skin Analyser backend (Cloudflare Worker)
 *
 * Receives the questionnaire plus one facial photograph, returns a structured
 * written assessment.
 *
 * DEPLOY: dash.cloudflare.com -> Workers & Pages -> lively-surf-87db -> Edit
 * code -> replace all -> Deploy.
 *   Secrets:  OPENROUTER_KEY, RESEND_KEY
 *   Binding:  KV namespace "zl-assessments" bound as ZL_ASSESSMENTS
 *   Optional: ZL_MODEL, ZL_MAX_TOKENS, ZL_FROM, ZL_SITE
 *
 * ---------------------------------------------------------------------------
 * WHY THE ASSESSMENT IS NOT RETURNED TO THE BROWSER
 *
 * An email address is only worth having if it is real, and the only way to show
 * that is to make the thing of value arrive in it. So the reading is written,
 * stored against an unguessable id, and sent — the page that requested it never
 * receives the report at all. Someone who types a fake address gets nothing,
 * and never enters the list as a genuine contact.
 *
 * The email carries a private link back to /analyser/?r=<id>, which is the only
 * way to read the assessment on screen and save it as a PDF. Ids are 128 bits
 * of randomness; they expire from KV after 30 days.
 *
 * If the send fails — a refused address, a mail outage — the report is returned
 * inline instead, because having someone wait through a reading and then handing
 * them nothing is a worse failure than showing it early.
 *
 * The photograph is still never stored, never attached to the email, and never
 * held against the address. That pledge is on the page and it stays literally
 * true: only the finished text is kept.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS WAS REWRITTEN
 *
 * The previous prompt was ~90 lines, much of it shouting in capitals, and it
 * produced padded, generic reports. Specific faults, all fixed here:
 *
 *  · temperature 0.9 on a clinical read. That is a creative-writing setting; it
 *    invented detail. Now 0.35 — the same photograph should yield broadly the
 *    same reading twice.
 *  · "Write 3-5 sentences per category" across eight categories forced padding.
 *    The model wrote to a word count instead of to what it could see. Now: say
 *    what is visible, stop, and say plainly when a marker cannot be judged.
 *  · "BE WILLING TO CONTRADICT THE QUIZ ANSWERS" pushed overconfidence about
 *    what a single phone photo can show. The photo leads, but uncertainty is
 *    now reportable rather than something to bulldoze.
 *  · Nothing constrained claims. A cosmetics brand in the UK/EU may describe
 *    APPEARANCE only; it may not diagnose or promise physiological change.
 *    That boundary is now stated in the prompt and enforced in the schema.
 *  · Recommendations ignored the protocol's fixed order and the two-effects
 *    idea that the whole brand rests on.
 * ---------------------------------------------------------------------------
 */

const DEFAULT_MODEL = 'openai/gpt-4o';
const DEFAULT_MAX_TOKENS = 3200;

/* Rate limit: an in-memory map is per-isolate, so this is a speed bump against
   accidental double-submits rather than real abuse protection. Cloudflare's own
   rate limiting is the right tool if this ever needs to be strict. */
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
}

const PRODUCTS = `THE RANGE — recommend only from these six, and respect the order.
01 Renew · Bio-Renewal Peeling Gel — weekly exfoliation. Aloe vera, brown algae,
   citric acid complex. Clears the surface so what follows can work.
02 Activate · Precision Collagen Renewal Line Corrector — weekly, applied along
   expression lines with a precision applicator (external; no needle, no
   injection). Hydrolysed collagen and botanical signal peptides.
03 Signal · Bio-Signal Face Serum — daily, morning and night. Botanical peptide
   complex on a Pyrenean mineral water base. The step that compounds.
04 Shield · Environmental Shield Day Cream — every morning, after the serum.
   Pyrenean minerals, red algae, sweet almond. Not a sunscreen; SPF goes on top.
05 Restore · Renewal and Repair Night Cream — every night. Niacinamide,
   hydrolysed collagen, lavender floral water, a restorative lipid matrix.
06 Sustain · Precision Collagen Renewal Refill — the cartridge that keeps
   step 02 going. Requires the applicator from 02.`;

const SYSTEM_PROMPT = `You are a senior skin consultant writing for Zero Lines, a clinical-luxury skincare house in Gibraltar, Andorra and Marbella. A client has sent one photograph and answered sixteen questions. Write their assessment.

HOW TO READ THE PHOTOGRAPH
The photograph is your primary evidence; the questionnaire is context that explains what you see. Where they disagree, describe what is visible and note the discrepancy plainly — for example, "you describe your skin as dry, though the T-zone here reads oily" — without lecturing.

Work through the face by zone: forehead, between the brows, around the eyes, cheeks, nose, nasolabial folds, chin, jawline. Name the zone whenever you note something.

Be honest about the limits of one photograph. Lighting, camera and make-up all affect what can be judged. If a marker genuinely cannot be assessed from this image, say so in one short sentence and move on. That is a better answer than a confident guess, and clients trust it more.

HOW TO WRITE
Write as a person, not a template. Vary sentence length. Say what you see, then stop — do not pad to a length. One vivid, specific observation is worth five general ones. No adjective stacking, no "delve", no "it's important to note", no three-item lists used reflexively.

Calm, precise, warm. If the skin is in good condition, say so directly and without flattery. If something needs attention, say that just as directly and without alarm.

WHAT YOU MAY AND MAY NOT CLAIM — this is a legal boundary, not a style note.
Zero Lines is a cosmetics house, not a medical one. You may describe how skin LOOKS and how a formulation is designed to work.
· Never diagnose. Not acne, rosacea, eczema, melasma, keratosis, or any condition. Describe the appearance instead: "congestion across the chin", "diffuse redness over the cheeks".
· Never promise physiological change, and never use "permanently", "removes", "erases" or "cures". Write "visibly smooths the appearance of", "designed to support the skin's own structure".
· Never cite a statistic, percentage, study, trial or panel. The brand publishes none, and inventing one is a serious error.
· If anything in the image suggests a matter for a doctor — a changing or irregular mole, persistent unexplained inflammation, anything asymmetric or ulcerated — do not name it. Recommend, warmly and without alarm, that they show it to a dermatologist, and set needsProfessionalReview to true.

${PRODUCTS}

RECOMMENDING
Recommend three or four steps, not all six, unless the reading genuinely calls for the full protocol. Keep them in protocol order. For each, connect it to something specific you actually observed — not to the questionnaire, and not to a generic benefit.

Zero Lines rests on one idea: every formulation does two things at once. There is an immediate effect, visible the same day, and a lasting effect that builds over weeks of consistent use. Reflect both in what you write, and in expectations, be honest that the second one takes time.

OUTPUT
Return ONLY valid JSON in exactly this shape. No markdown fence, no commentary.
{
  "overallScore": 7,
  "scoreLabel": "Short phrase — six words at most",
  "summary": "One paragraph. Open with the most striking thing in the photograph, then place it in context. 60-110 words.",
  "photoAnalysis": {
    "texture": "", "tone": "", "hydration": "", "poreQuality": "",
    "pigmentation": "", "wrinkles": "", "elasticity": "", "sunDamage": ""
  },
  "rootCauses": [ { "factor": "Three or four words", "explanation": "Two or three sentences connecting what is visible to why it happens." } ],
  "lifestyleRecommendations": ["Specific and actionable. Four or five of them."],
  "productRecommendations": [ { "product": "Exact name from the range", "why": "Tie it to a specific observation.", "immediately": "What they should notice the same day.", "overTime": "What builds with consistent use." } ],
  "expectedResults": "Honest and staged: the first week, the first month, then eight to twelve weeks. No numbers.",
  "confidence": "high | moderate | limited — how much this photograph supported, given its lighting and clarity",
  "needsProfessionalReview": false,
  "consultationNote": "Two sentences referring to something specific you saw, inviting a conversation with a specialist."
}

Each photoAnalysis field: two to four sentences, naming zones. If a marker cannot be judged from this image, write one sentence saying exactly that.

SCORING — anchor it, do not default to the middle.
9-10 exceptional for their age; 7-8 good with minor points; 5-6 several visible concerns; 3-4 significant; 1-2 substantially compromised. Judge relative to the age range they gave. Justify the number in the summary.`;

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

/* Ids for stored assessments: 128 bits, base64url. Long enough that the link
   in someone's inbox is the only practical way to reach their reading. */
function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const ASSESSMENT_TTL_S = 60 * 60 * 24 * 30;   // 30 days

/* ---------------------------------------------------------------------------
   The email.

   Plain HTML with inline styles and a table spine, because that is what mail
   clients render reliably — no webfonts, no external CSS, no images. Georgia
   stands in for Cormorant; every client has it.
   --------------------------------------------------------------------------- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MARKERS = [
  ['texture', 'Texture'], ['tone', 'Tone'], ['hydration', 'Hydration'],
  ['poreQuality', 'Pores'], ['pigmentation', 'Pigmentation'],
  ['wrinkles', 'Lines'], ['elasticity', 'Elasticity'], ['sunDamage', 'Sun exposure'],
];

function buildEmail(report, link) {
  const BONE = '#FAF7F2', INK = '#14181A', INK3 = '#3C4142';
  const HOUSE = '#1F4F4A', MID = '#17706D', CHAMP = '#C2A878';
  const p = (t, extra) => `<p style="margin:0 0 14px;font:400 15px/1.75 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK3};${extra || ''}">${t}</p>`;

  let body = '';
  body += `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">Your written assessment</h1>`;
  body += `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">Prepared by the Zero Lines analyser</p>`;

  if (report.scoreLabel || typeof report.overallScore === 'number') {
    const outOf = report.overallScore > 10 ? 100 : 10;
    body += `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:2px solid ${CHAMP};margin:0 0 26px"><tr>`
      + `<td style="padding:16px 0 0"><span style="font:300 40px/1 Georgia,serif;color:${MID}">${esc(report.overallScore)}</span>`
      + `<span style="font:400 14px/1 -apple-system,sans-serif;color:${INK3}"> / ${outOf}</span>`
      + (report.scoreLabel ? `<div style="margin-top:6px;font:400 15px/1.6 Georgia,serif;color:${INK}">${esc(report.scoreLabel)}</div>` : '')
      + `</td></tr></table>`;
  }

  if (report.summary) body += p(esc(report.summary), `font-size:16px;color:${INK};`);

  /* The private link. It is the only way back to this reading, and the only way
     to save it as a PDF, so it sits high rather than buried in a footer. */
  if (link) {
    body += `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr>`
      + `<td style="background:${HOUSE};padding:14px 26px">`
      + `<a href="${esc(link)}" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Open it and save as PDF</a>`
      + `</td></tr></table>`
      + p('This link is private to you and works for thirty days.', 'font-size:12px;color:#636764;margin-top:10px;');
  }

  const pa = report.photoAnalysis || {};
  const present = MARKERS.filter(([k]) => pa[k]);
  if (present.length) {
    body += `<h2 style="margin:30px 0 14px;font:300 21px/1.3 Georgia,serif;color:${INK}">What the photograph showed</h2>`;
    for (const [k, label] of present) {
      body += `<div style="border-top:1px solid #E2DCD2;padding:14px 0 2px">`
        + `<div style="font:500 11px/1.6 -apple-system,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">${esc(label)}</div>`
        + p(esc(pa[k]), 'margin-top:6px;')
        + `</div>`;
    }
  }

  const recs = Array.isArray(report.productRecommendations) ? report.productRecommendations : [];
  if (recs.length) {
    body += `<h2 style="margin:30px 0 14px;font:300 21px/1.3 Georgia,serif;color:${INK}">What we would suggest</h2>`;
    for (const r of recs) {
      body += `<div style="border-top:1px solid #E2DCD2;padding:16px 0 4px">`
        + `<div style="font:400 17px/1.4 Georgia,serif;color:${INK}">${esc(r.product)}</div>`
        + (r.why ? p(esc(r.why), 'margin-top:8px;') : '')
        + (r.immediately ? p(`<strong style="color:${HOUSE}">Immediately</strong> — ${esc(r.immediately)}`, 'margin-top:2px;font-size:14px;') : '')
        + (r.overTime ? p(`<strong style="color:${HOUSE}">Over time</strong> — ${esc(r.overTime)}`, 'margin-top:2px;font-size:14px;') : '')
        + `</div>`;
    }
  }

  const life = Array.isArray(report.lifestyleRecommendations) ? report.lifestyleRecommendations : [];
  if (life.length) {
    body += `<h2 style="margin:30px 0 12px;font:300 21px/1.3 Georgia,serif;color:${INK}">Alongside the protocol</h2><ul style="margin:0 0 14px;padding-left:20px">`;
    for (const l of life) body += `<li style="font:400 15px/1.75 -apple-system,sans-serif;color:${INK3};margin-bottom:8px">${esc(l)}</li>`;
    body += `</ul>`;
  }

  if (report.expectedResults) {
    body += `<h2 style="margin:30px 0 12px;font:300 21px/1.3 Georgia,serif;color:${INK}">What to expect</h2>` + p(esc(report.expectedResults));
  }

  if (report.needsProfessionalReview) {
    body += `<div style="background:#E8EFEC;border-left:2px solid ${MID};padding:16px 18px;margin:24px 0">`
      + p('One thing in your photograph is worth showing to a dermatologist. That is not a diagnosis and not a cause for alarm — it is simply outside what a skincare assessment should judge.', 'margin:0;')
      + `</div>`;
  }

  body += `<div style="border-top:1px solid #E2DCD2;margin-top:32px;padding-top:20px">`
    + p('This is a cosmetic assessment of appearance. It is not a medical diagnosis and does not replace advice from a healthcare professional. The Zero Lines collection is in pre-launch and not yet available to purchase.', 'font-size:12px;color:#636764;')
    + p('Your photograph was read once and was not stored. It is not attached to this email.', 'font-size:12px;color:#636764;')
    + `</div>`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${BONE}">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BONE}"><tr><td align="center" style="padding:32px 16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;padding:36px 34px">`
    + `<tr><td><div style="font:500 15px/1 -apple-system,sans-serif;letter-spacing:5px;text-transform:uppercase;color:${INK};padding-bottom:28px">Zero Lines</div>${body}</td></tr>`
    + `</table>`
    + `<div style="font:400 12px/1.7 -apple-system,sans-serif;color:#636764;padding-top:18px;max-width:600px">Zero Lines · Gibraltar &middot; Andorra &middot; Marbella · <a href="https://zerolines.life" style="color:${MID}">zerolines.life</a></div>`
    + `</td></tr></table></body></html>`;

  const lines = ['YOUR WRITTEN ASSESSMENT', '', report.summary || ''];
  for (const [k, label] of present) lines.push('', label.toUpperCase(), pa[k]);
  if (recs.length) { lines.push('', 'WHAT WE WOULD SUGGEST'); for (const r of recs) lines.push('', r.product, r.why || ''); }
  if (link) lines.push('', 'Open it and save as PDF: ' + link, 'This link is private to you and works for thirty days.');
  lines.push('', 'This is a cosmetic assessment of appearance, not a medical diagnosis.',
    'Your photograph was read once and was not stored.', '', 'zerolines.life');

  return { html, text: lines.filter((l) => l !== undefined).join('\n') };
}

/* ---------------------------------------------------------------------------
   The confirmation email.

   Someone joined the waitlist on 4 August and heard nothing back, because
   nothing existed to answer them. This is that.

   Its job is not to say thank you. Registering is a passive act — the person is
   now waiting for a launch with no committed date, which means the next thing
   they hear from us could be months away, by which time they have forgotten who
   we are. The analyser is free, finished, and open today. So the email's real
   work is to move someone from the list into the one experience that already
   exists, and its centre of gravity is that link.

   Same visual grammar as the assessment email: table spine, inline styles,
   Georgia standing in for Cormorant, no webfonts and no images, because that is
   what mail clients render the same way twice.
   --------------------------------------------------------------------------- */
function buildWelcome(kind) {
  const BONE = '#FAF7F2', INK = '#14181A', INK3 = '#3C4142';
  const HOUSE = '#1F4F4A', MID = '#17706D', CHAMP = '#C2A878';
  const SITE = 'https://zerolines.life';
  const p = (t, extra) => `<p style="margin:0 0 14px;font:400 15px/1.75 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK3};${extra || ''}">${t}</p>`;
  const h2 = (t) => `<h2 style="margin:30px 0 12px;font:300 21px/1.3 Georgia,serif;color:${INK}">${t}</h2>`;
  const rule = `<div style="border-top:1px solid #E2DCD2;margin-top:32px;padding-top:20px">`;

  let subject, body = '', lines = [];

  if (kind === 'contact') {
    subject = 'We have your message';
    body += `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">We have your message</h1>`
      + `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">Zero Lines · Gibraltar &middot; Andorra &middot; Marbella</p>`
      + p('Thank you for writing. Your message has reached us and someone will read it and answer personally.', `font-size:16px;color:${INK};`)
      + p('We use what you sent only to reply to you. It does not join a mailing list, and this is the last automatic message you will get about it — the next one will be from a person.');
    lines = ['WE HAVE YOUR MESSAGE', '',
      'Thank you for writing. Your message has reached us and someone will read it and answer personally.', '',
      'We use what you sent only to reply to you. It does not join a mailing list, and this is the last automatic message you will get about it — the next one will be from a person.'];
  } else {
    subject = 'You are on the list';
    body += `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">You are on the list</h1>`
      + `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">Zero Lines · Gibraltar &middot; Andorra &middot; Marbella</p>`
      + p('Thank you for registering. When ordering opens you will hear from us before anyone else — that is the entire purpose of the list, and it is the only list we keep.', `font-size:16px;color:${INK};`)
      /* No date. The site commits to none anywhere, and a launch date invented
         in an email is the one promise a pre-launch brand cannot quietly walk
         back — it arrives in writing, in someone's inbox, and it stays there. */
      + p('We have not set a date, and we would rather say that plainly than guess at one.');

    body += h2('You do not have to wait for us')
      + p('The skin analysis is free, open now, and does not depend on the launch. One photograph and sixteen questions; a written assessment comes back to this address — read zone by zone, with a note on what a single photograph honestly cannot show.')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>`
      + `<td style="background:${HOUSE};padding:14px 26px">`
      + `<a href="${SITE}/analyser/" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Begin the analysis</a>`
      + `</td></tr></table>`
      + p('It takes about four minutes and needs no account.', 'font-size:12px;color:#636764;margin-top:10px;');

    body += `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:2px solid ${CHAMP};margin:30px 0 0"><tr><td style="padding:18px 0 0">`
      + `<div style="font:500 11px/1.6 -apple-system,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">What we are building</div>`
      + p('Every Zero Lines formulation is made to do two things at once. There is an immediate effect, visible the same day. And there is a lasting one, which builds quietly over weeks of consistent use. Most of the industry sells the first and implies the second. We would rather tell you which is which.', 'margin-top:10px;')
      + `</td></tr></table>`;

    lines = ['YOU ARE ON THE LIST', '',
      'Thank you for registering. When ordering opens you will hear from us before anyone else — that is the entire purpose of the list, and it is the only list we keep.', '',
      'We have not set a date, and we would rather say that plainly than guess at one.', '',
      'YOU DO NOT HAVE TO WAIT FOR US', '',
      'The skin analysis is free, open now, and does not depend on the launch. One photograph and sixteen questions; a written assessment comes back to this address.', '',
      'Begin the analysis: ' + SITE + '/analyser/', 'It takes about four minutes and needs no account.', '',
      'WHAT WE ARE BUILDING', '',
      'Every Zero Lines formulation is made to do two things at once. There is an immediate effect, visible the same day. And there is a lasting one, which builds quietly over weeks of consistent use. Most of the industry sells the first and implies the second. We would rather tell you which is which.'];
  }

  body += rule
    + p('The Zero Lines collection is in pre-launch and not yet available to purchase.', 'font-size:12px;color:#636764;')
    + (kind === 'contact' ? '' : p('If you would rather not hear from us again, reply to this message and we will take you off the list. No form, no link, no questions.', 'font-size:12px;color:#636764;'))
    + `</div>`;

  lines.push('', 'The Zero Lines collection is in pre-launch and not yet available to purchase.');
  if (kind !== 'contact') lines.push('If you would rather not hear from us again, reply to this message and we will take you off the list.');
  lines.push('', 'zerolines.life');

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${BONE}">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BONE}"><tr><td align="center" style="padding:32px 16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;padding:36px 34px">`
    + `<tr><td><div style="font:500 15px/1 -apple-system,sans-serif;letter-spacing:5px;text-transform:uppercase;color:${INK};padding-bottom:28px">Zero Lines</div>${body}</td></tr>`
    + `</table>`
    + `<div style="font:400 12px/1.7 -apple-system,sans-serif;color:#636764;padding-top:18px;max-width:600px">Zero Lines · Gibraltar &middot; Andorra &middot; Marbella · <a href="${SITE}" style="color:${MID}">zerolines.life</a></div>`
    + `</td></tr></table></body></html>`;

  return { subject, html, text: lines.join('\n') };
}

/* Constant-time string compare. A plain === on a shared secret leaks its prefix
   through timing; the cost of doing it properly here is nil. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------------------------------------------------------------------
   Netlify calls this on every form submission. Without the shared secret it is
   an open relay that will send Zero Lines-branded mail to any address a
   stranger posts, which is how a sending domain gets blocklisted.
   --------------------------------------------------------------------------- */
async function handleWelcome(request, env, url, cors) {
  if (!env.HOOK_SECRET || !safeEqual(url.searchParams.get('k') || '', env.HOOK_SECRET)) {
    return json({ error: 'Not found.' }, 404, cors);
  }
  if (!env.RESEND_KEY) return json({ error: 'Mail is not configured.' }, 503, cors);

  let sub;
  try { sub = await request.json(); } catch (e) { return json({ error: 'Unreadable.' }, 400, cors); }

  const data = (sub && sub.data) || {};
  const form = String(sub.form_name || data['form-name'] || '').toLowerCase();
  const email = String(sub.email || data.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return json({ ok: true, skipped: 'no usable address' }, 200, cors);
  }

  /* The analyser records its leads into the waitlist form, so without this the
     person who has just read their own assessment gets a second email inviting
     them to go and do the analysis. They already did. That is the difference
     between a brand that is paying attention and one that is not. */
  if (String(data.source || '').toLowerCase() === 'analyser') {
    return json({ ok: true, skipped: 'analyser lead — assessment already sent' }, 200, cors);
  }

  /* Netlify retries a webhook that does not answer quickly enough, and a
     duplicate welcome is worse than a late one. The submission id is stable
     across retries, so it is the natural key. */
  const key = 'welcomed:' + (sub.id || email);
  if (env.ZL_ASSESSMENTS) {
    if (await env.ZL_ASSESSMENTS.get(key)) return json({ ok: true, skipped: 'already sent' }, 200, cors);
  }

  const { subject, html, text } = buildWelcome(form === 'contact' ? 'contact' : 'waitlist');

  let sent;
  try {
    sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.ZL_FROM || 'Zero Lines <scan@zerolines.life>',
        to: [email],
        reply_to: 'info@zerolines.life',
        subject, html, text,
      }),
    });
  } catch (e) {
    return json({ error: 'Mail service unreachable.' }, 502, cors);
  }

  if (!sent.ok) {
    const detail = (await sent.text()).slice(0, 200);
    return json({ error: 'Send failed.', detail }, 502, cors);
  }

  if (env.ZL_ASSESSMENTS) {
    try { await env.ZL_ASSESSMENTS.put(key, '1', { expirationTtl: 60 * 60 * 24 * 90 }); } catch (e) { /* a duplicate is survivable */ }
  }
  return json({ ok: true, sent: email, form }, 200, cors);
}

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    /* Netlify's form webhook. Checked before anything else so the analyser path
       below is untouched — that endpoint is live and working, and this is an
       addition to it, not a change to it. */
    if (request.method === 'POST' && url.pathname === '/welcome') {
      return handleWelcome(request, env, url, cors);
    }

    /* Reading an assessment back, from the private link in the email. The id is
       the only credential — which is what makes the inbox the key. */
    if (request.method === 'GET') {
      const id = url.searchParams.get('r');
      if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
        return json({ error: 'Not found.' }, 404, cors);
      }
      if (!env.ZL_ASSESSMENTS) return json({ error: 'Storage is not configured.' }, 503, cors);
      const stored = await env.ZL_ASSESSMENTS.get(id);
      if (!stored) {
        return json({ error: 'That assessment has expired, or the link is incomplete. Assessments are kept for thirty days.' }, 404, cors);
      }
      return new Response(stored, { status: 200, headers: { ...cors, 'Cache-Control': 'private, max-age=300' } });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return json({ error: 'Too many analyses in a short time. Please wait a moment and try again.' }, 429, cors);
    }

    const len = request.headers.get('content-length');
    if (len && parseInt(len, 10) > 12 * 1024 * 1024) {
      return json({ error: 'That photograph is too large. Please use one under about 8MB.' }, 413, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: 'Could not read the request.' }, 400, cors);
    }

    const { answers, answerLabels, photoBase64, email: rawEmail } = payload || {};

    /* An address is required before anything is written. This is the whole
       mechanism: the reading only ever arrives by email, so an address that
       cannot receive it never becomes a contact. */
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return json({ error: 'Please give an email address we can send your assessment to.' }, 400, cors);
    }
    if (!env.RESEND_KEY) {
      return json({ error: 'The assessment service is not configured to send email yet.' }, 503, cors);
    }

    /* Record the address NOW, before the model is asked for anything.
       Until this line, a lead existed only if the model answered AND the mail
       sent AND the reader kept the tab in the foreground for the fifteen to
       sixty seconds the reading takes — because the only recorder was a
       fetch() fired from the browser after success. Every other path lost the
       person completely: a model timeout, an out-of-credit key, a locked
       phone. They had given us a real address and a photograph of their face
       and we kept neither.

       Fire-and-forget, and deliberately not awaited: this must never be able
       to delay or fail an assessment. The second record, tagged `analyser`,
       still lands on success — so the gap between the two counts is the
       abandonment rate, which is the number that decides whether the
       photograph requirement is costing more than it is worth. */
    if (ctx && typeof ctx.waitUntil === 'function') {
      const started = new URLSearchParams();
      started.set('form-name', 'waitlist');
      started.set('email', email);
      started.set('source', 'analyser-started');
      ctx.waitUntil(
        /* The apex, now that it is this Worker and not Netlify. The old
           default was the workers.dev hostname, chosen while the cutover was
           still in progress; it outlived its reason, and a form endpoint
           answering on workers.dev sits permanently outside every WAF and rate
           limit Cloudflare can put in front of a zone.

           X-ZL-Relay is how the site Worker knows this is us. There is no
           browser in this request and so no Turnstile token it could ever
           carry: without the header, the moment the challenge is armed this
           early capture would be refused and silently discarded. Both Workers
           already hold HOOK_SECRET, so the header costs nothing to add and
           needs no new secret. */
        fetch((env.ZL_FORMS || 'https://zerolines.life').replace(/\/+$/, '') + '/__forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-ZL-Relay': env.HOOK_SECRET || '',
          },
          body: started.toString(),
        }).catch(() => {})
      );
    }

    if (!answers || !photoBase64) return json({ error: 'Missing answers or photograph.' }, 400, cors);
    if (typeof photoBase64 !== 'string' || !photoBase64.startsWith('data:image/')) {
      return json({ error: 'The photograph must be a base64 image data URL.' }, 400, cors);
    }
    if (photoBase64.length > 11 * 1024 * 1024) {
      return json({ error: 'That photograph is too large. Please use one under about 8MB.' }, 413, cors);
    }
    if (!env.OPENROUTER_KEY) {
      return json({ error: 'The analysis service is not configured.' }, 500, cors);
    }

    /* Prefer the wording the visitor actually read.

       The questionnaire stores slugs — "dry", "daily-no-spf" — and until now
       those slugs were what arrived here, so the assessor was told
       "Self-described skin type: dry" while the visitor had chosen "Dry —
       tight, sometimes flaky, drinks up moisture". Every description written
       into an option was thrown away one step before the only reader who could
       have used it. The browser now sends both; slugs remain the stored form,
       labels are what goes into the prompt. Falls back to the slug so an older
       cached page still produces a reading. */
    const src = (answerLabels && typeof answerLabels === 'object') ? answerLabels : (answers || {});
    const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const field = (v, fallback) => (v && String(v).trim()) || fallback;

    const profile = [
      `Age range: ${field(src.age, 'not given')}`,
      `How the skin feels half an hour after washing: ${field(src.skinType, 'not given')}`,
      `Reactivity to unfamiliar products — their own account, not a diagnosis: ${field(src.sensitivity, 'not given')}`,
      `What the skin does in strong sun — use this as the baseline for tone, and read redness and pigment against it rather than against an average face: ${field(src.sunReaction, 'not given')}`,
      `Main concerns: ${list(src.concerns).join(', ') || 'none given'}`,
      `Priority — the one thing they most want to change: ${field(src.priority, 'not given')}`,
      `How strongly that priority registers to them: ${field(src.intensity, 'not given')}`,
      `Sun over the years: ${field(src.sun, 'not given')}`,
      `Sun in the last month: ${field(src.recentSun, 'not given')}`,
      `On their skin at the moment: ${list(src.treatments).join(', ') || 'nothing reported'}`,
      `How long those have been in the routine: ${field(src.activeTenure, 'not given')}`,
      `Current routine: ${field(src.routine, 'not given')}`,
      `Lifestyle factors: ${list(src.lifestyle).join(', ') || 'none reported'}`,
      `Climate and surroundings: ${field(src.climate, 'not given')}`,
      `Shaving or facial hair removal: ${field(src.shaving, 'not given')}`,
      `On the face in this photograph: ${field(src.bareFace, 'not given')}`,
    ].join('\n');

    const userPrompt = `${profile}

The attached photograph is your primary evidence. Read it zone by zone before you write anything, then produce the assessment as specified. Where the photograph and the answers disagree, describe what you can see and note the difference without lecturing. Where the image does not support a judgement, say so rather than guessing.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zerolines.life',
          'X-Title': 'Zero Lines Skin Analyser',
        },
        body: JSON.stringify({
          model: env.ZL_MODEL || DEFAULT_MODEL,
          /* The page promises the photograph is not retained and not used for
             training. That promise is only ours to make if we actually ask for
             it — this restricts routing to providers that agree, rather than
             trusting the default. Without it the claim was a hope. */
          provider: { data_collection: 'deny' },
          // 0.35, not 0.9. This is a reading, not a creative brief — the same
          // photograph should produce broadly the same assessment twice.
          temperature: 0.35,
          max_tokens: parseInt(env.ZL_MAX_TOKENS, 10) || DEFAULT_MAX_TOKENS,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: photoBase64, detail: 'high' } },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err && err.name === 'AbortError';
      return json({ error: aborted ? 'The analysis took too long. Please try again.' : 'Could not reach the analysis service.' }, 504, cors);
    }
    clearTimeout(timer);

    if (!response.ok) {
      const raw = await response.text();
      let detail;
      try { detail = JSON.parse(raw); } catch { detail = { raw: raw.slice(0, 400) }; }
      // Surface the one failure the owner can actually act on.
      const msg = JSON.stringify(detail);
      const outOfCredit = response.status === 402 || /more credits|insufficient/i.test(msg);
      return json({
        error: outOfCredit
          ? 'The analysis service is out of credit.'
          : 'The analysis service returned an error.',
        status: response.status,
        details: detail,
      }, 502, cors);
    }

    let ai;
    try { ai = await response.json(); } catch (e) {
      return json({ error: 'The analysis service returned something unreadable.' }, 502, cors);
    }

    const content = ai && ai.choices && ai.choices[0] && ai.choices[0].message && ai.choices[0].message.content;
    if (!content) return json({ error: 'The analysis came back empty.', response: ai }, 502, cors);

    const report = parseReport(content);
    if (!report) {
      return json({ error: 'Could not read the analysis.', rawContent: String(content).slice(0, 1500) }, 502, cors);
    }

    // Never let an invented statistic through, whatever the prompt said.
    scrubClaims(report);

    /* Store it, then send it. Storage first: if the mail service is having a
       bad minute we would still rather the link work than lose the reading. */
    const site = (env.ZL_SITE || 'https://zerolines.life').replace(/\/+$/, '');
    const id = newId();
    const link = `${site}/analyser/?r=${id}`;

    if (env.ZL_ASSESSMENTS) {
      try {
        await env.ZL_ASSESSMENTS.put(id, JSON.stringify(report), { expirationTtl: ASSESSMENT_TTL_S });
      } catch (e) { /* fall through — the email still carries the full text */ }
    }

    const { html, text } = buildEmail(report, link);
    let sentOk = false;
    let sendError = '';
    try {
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.ZL_FROM || 'Zero Lines <scan@zerolines.life>',
          to: [email],
          reply_to: 'info@zerolines.life',
          subject: 'Your Zero Lines skin assessment',
          html,
          text,
        }),
      });
      sentOk = sent.ok;
      if (!sent.ok) sendError = (await sent.text()).slice(0, 200);
    } catch (e) {
      sendError = 'unreachable';
    }

    if (sentOk) {
      // The reading itself is deliberately NOT in this response.
      return json({ ok: true, emailed: true, to: email }, 200, cors);
    }

    /* The send failed. Handing back nothing after a two-minute questionnaire and
       a fifteen-second wait would be the worse outcome, so the reading is
       returned inline and the page explains why it is on screen. */
    return json({ ...report, emailed: false, sendError, link: env.ZL_ASSESSMENTS ? link : '' }, 200, cors);
  },
};

/* Parsing: response_format json_object should make this unnecessary, but models
   still occasionally wrap output in a fence. Three strategies, cheapest first. */
function parseReport(content) {
  const attempts = [];
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1]);
  attempts.push(content);
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last > first) attempts.push(content.slice(first, last + 1));

  for (const a of attempts) {
    try {
      const parsed = JSON.parse(a.trim());
      if (parsed && typeof parsed === 'object' && parsed.summary) return parsed;
    } catch (e) { /* next */ }
  }
  return null;
}

/* A last line of defence. The prompt forbids statistics and diagnoses, but the
   brand's legal exposure should not rest on the model having complied. */
function scrubClaims(report) {
  /* Two different failures, needing two different repairs.

     A stray statistic can be cut out and the sentence still reads: "visibly
     smoother" survives losing "by 40%". A diagnosis cannot. Deleting the word
     "rosacea" from "this presentation is consistent with rosacea across the
     cheeks" leaves a sentence that is now merely broken, and still gestures at
     the thing it must not say. The comment on this function has always named
     diagnosis as the risk; only statistics were ever filtered.

     So: statistics are excised, and any field naming a medical condition is
     replaced wholesale with an honest sentence about what a photograph can and
     cannot establish. */
  const STAT = /\b\d{1,3}\s?%|\bclinically (proven|tested)\b|\bdermatologist[- ]approved\b|\bpermanently\b|\bcures?\b|\beliminates?\b|\berases?\b/gi;
  const CONDITION = /\b(acne(?:\s+vulgaris)?|rosacea|eczema|psoriasis|dermatitis|melasma|keratosis|vitiligo|impetigo|folliculitis|melanoma|carcinoma|cellulitis|shingles|urticaria)\b/i;
  const REPLACEMENT = 'This describes how the skin looks in the photograph. Anything that might have a medical explanation is outside what an assessment of appearance can judge, and is worth showing to a dermatologist.';

  let flagged = false;
  const walk = (node, key, parent) => {
    if (typeof node === 'string') {
      if (CONDITION.test(node)) {
        flagged = true;
        parent[key] = REPLACEMENT;
        return;
      }
      if (STAT.test(node)) {
        /* Excising the phrase leaves rubble — "Smoothness improved by 40% in
           the T-zone" became "Smoothness improved by in the T-zone", which is
           worse than the claim it removed, because it is visibly broken and
           still in someone's inbox. Drop the whole sentence instead and keep
           the rest of the field; only if nothing survives do we say so. */
        const kept = node
          .split(/(?<=[.!?])\s+/)
          .filter((sentence) => { STAT.lastIndex = 0; return !STAT.test(sentence); })
          .join(' ')
          .trim();
        parent[key] = kept.length > 24 ? kept : 'Nothing here that a photograph can be specific about.';
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, i, node));
    if (node && typeof node === 'object') return Object.keys(node).forEach((k) => walk(node[k], k, node));
  };
  walk(report, null, null);

  // If the model named a condition anywhere, the reader should be told to have
  // it looked at — that is the whole point of catching it.
  if (flagged) report.needsProfessionalReview = true;
}
