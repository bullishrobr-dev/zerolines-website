/**
 * Zero Lines — Skin Analyser backend (Cloudflare Worker)
 *
 * Receives the questionnaire plus one facial photograph, returns a structured
 * written assessment.
 *
 * DEPLOY: dash.cloudflare.com -> Workers & Pages -> your worker -> replace all
 * code with this file -> Deploy. Secret required: OPENROUTER_KEY.
 * Optional vars: ZL_MODEL (defaults below), ZL_MAX_TOKENS.
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
02 Activate · Precision Collagen Activation Syringe — weekly, applied along
   expression lines with a precision applicator (external; no needle, no
   injection). Hydrolysed collagen and botanical signal peptides.
03 Signal · BioSignal Facial Serum — daily, morning and night. Botanical peptide
   complex on a Pyrenean mineral water base. The step that compounds.
04 Shield · Environmental Shield Day Cream — every morning, after the serum.
   Pyrenean minerals, red algae, sweet almond. Not a sunscreen; SPF goes on top.
05 Restore · Renewal and Repair Night Cream — every night. Niacinamide,
   hydrolysed collagen, lavender floral water, a restorative lipid matrix.
06 Sustain · Precision Collagen Activation Refill — the cartridge that keeps
   step 02 going. Requires the applicator from 02.`;

const SYSTEM_PROMPT = `You are a senior skin consultant writing for Zero Lines, a clinical-luxury skincare house in Gibraltar and Barcelona. A client has sent one photograph and answered ten questions. Write their assessment.

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

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return json({ error: 'Too many analyses in a short time. Please wait a moment and try again.' }, 429, cors);
    }

    const len = request.headers.get('content-length');
    if (len && parseInt(len, 10) > 12 * 1024 * 1024) {
      return json({ error: 'That photograph is too large. Please use one under about 8MB.' }, 413, cors);
    }

    let answers, photoBase64;
    try {
      ({ answers, photoBase64 } = await request.json());
    } catch (e) {
      return json({ error: 'Could not read the request.' }, 400, cors);
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

    const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const field = (v, fallback) => (v && String(v).trim()) || fallback;

    const profile = [
      `Age range: ${field(answers.age, 'not given')}`,
      `Gender: ${field(answers.gender, 'not given')}`,
      `Self-described skin type: ${field(answers.skinType, 'not given')}`,
      `Climate: ${field(answers.climate, 'not given')}`,
      `Main concerns: ${list(answers.concerns).join(', ') || 'none given'}`,
      `Priority — the one thing they most want to change: ${field(answers.priority, 'not given')}`,
      `Sun habit: ${field(answers.sun, 'not given')}`,
      `Sleep: ${field(answers.sleep, 'not given')}`,
      `Current routine: ${field(answers.routine, 'not given')}`,
      `Tried before: ${list(answers.treatments).join(', ') || 'nothing reported'}`,
      `How long these concerns have been present: ${field(answers.duration, 'not given')}`,
      `Lifestyle factors: ${list(answers.lifestyle).join(', ') || 'none reported'}`,
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

    return json(report, 200, cors);
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
  const BANNED = /\b\d{1,3}\s?%|\bclinically (proven|tested)\b|\bdermatologist[- ]approved\b|\bpermanently\b|\bcures?\b|\beliminates?\b|\berases?\b/gi;
  const walk = (node, key, parent) => {
    if (typeof node === 'string') {
      if (BANNED.test(node)) parent[key] = node.replace(BANNED, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, i, node));
    if (node && typeof node === 'object') return Object.keys(node).forEach((k) => walk(node[k], k, node));
  };
  walk(report, null, null);
}
