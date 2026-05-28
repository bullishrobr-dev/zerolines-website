/**
 * Zero Lines AI Face Analyzer — Cloudflare Worker Backend
 *
 * Receives quiz answers + face photo, sends to GPT-4o via OpenRouter,
 * returns a comprehensive dermatologist-style skin analysis report.
 *
 * DEPLOYMENT:
 * 1. https://dash.cloudflare.com/ → Workers & Pages → your worker
 * 2. Replace ALL code with this file
 * 3. Deploy
 */

// Simple in-memory rate limiter: max 5 requests per IP per minute
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5;
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > maxRequests) {
    return true;
  }
  rateLimitMap.set(ip, entry);
  return false;
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 5 analyses per minute.' }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Request size limit (~5MB)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Request too large. Max 5MB.' }),
        { status: 413, headers: corsHeaders }
      );
    }

    try {
      const body = await request.json();
      const { answers, photoBase64 } = body;

      if (!answers || !photoBase64) {
        return new Response(
          JSON.stringify({ error: 'Missing answers or photo' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Validate photo is a data URL image
      if (typeof photoBase64 !== 'string' || !photoBase64.startsWith('data:image/')) {
        return new Response(
          JSON.stringify({ error: 'Invalid photo format. Must be a base64 data URL image.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Sanity-check photo size (base64 ~4/3 of binary; 4MB binary ~5.3MB base64)
      if (photoBase64.length > 7 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: 'Photo too large. Max ~4MB image.' }),
          { status: 413, headers: corsHeaders }
        );
      }

      // Extract quiz fields with fallbacks
      const age = answers.age || 'Not specified';
      const gender = answers.gender || 'Not specified';
      const skinType = answers.skinType || 'Not specified';
      const climate = answers.climate || 'Not specified';
      const concerns = Array.isArray(answers.concerns) ? answers.concerns : [answers.concerns || 'Not specified'];
      const routine = answers.routine || 'Not specified';
      const sleep = answers.sleep || 'Not specified';
      const duration = answers.duration || 'Not specified';
      const treatments = Array.isArray(answers.treatments) ? answers.treatments : [];
      const lifestyle = Array.isArray(answers.lifestyle) ? answers.lifestyle : [];

      const systemPrompt = `You are a senior dermatology consultant for Zero Lines, a clinical-luxury Skin Longevity House based in Gibraltar. You analyse a client's facial photo and lifestyle questionnaire to produce a vivid, genuinely personalised skin analysis report.

ZERO LINES PRODUCT RANGE (use only these):
1. Bio-Renewal Peeling Gel — gentle weekly exfoliation with citric acid + cotton seed. For dullness, congestion, uneven texture.
2. Precision Collagen Activation Syringe — concentrated hydrolyzed collagen. For loss of firmness, fine lines, structural ageing.
3. BioSignal Facial Serum — Pyrenean mineral complex serum. For cellular communication, barrier support, all skin types.
4. Environmental Shield Day Cream — mineral defence + pollution protection. For environmental damage, dehydration, daytime.
5. Renewal and Repair Night Cream — botanical renewal overnight. For barrier repair, fine lines, recovery.
6. Precision Collagen Activation Refill — refill for the syringe.

BRAND PHILOSOPHY:
- Skin already knows how to repair itself; we restore the signal
- Botanical science + Pyrenean mineral complexes from high-altitude springs
- Clinical-grade, not cosmetic
- 8–12 weeks for structural improvements

CRITICAL INSTRUCTIONS — READ CAREFULLY:

1. THE PHOTO IS YOUR PRIMARY EVIDENCE. The quiz answers are context, but what you SEE in the photo takes precedence. If the client says they have "dry skin" but the photo shows an oily T-zone with shine and visible pores — trust the photo and report what you see. If they say they have "no wrinkles" but you see crow's feet and forehead lines in the photo — call them out. BE WILLING TO CONTRADICT THE QUIZ ANSWERS. This is what makes you a real dermatologist.

2. SCORE MUST VARY BASED ON THE PHOTO. Do NOT default to middle scores. Look at the actual face:
   - 8-9: Genuinely excellent skin — even tone, minimal pores, no visible damage, good elasticity
   - 6-7: Good skin with minor issues — a few fine lines, slight dullness, one or two concern areas
   - 4-5: Moderate issues — visible congestion, uneven tone, early wrinkling, some dehydration
   - 2-3: Significant concerns — deep lines, obvious sun damage, poor texture, sagging
   - 1: Severely compromised skin
   - 10: Nearly impossible, reserved for truly exceptional cases
   The score must be justified by SPECIFIC observations from the photo.

3. PHOTO ANALYSIS — EXAMINE EVERY ZONE METHODICALLY. Do not write generic filler. Describe what you ACTUALLY see in THIS specific photo:
   - Texture: Scan forehead, cheeks, chin, T-zone, jawline. Is it glassy-smooth, bumpy, rough, congested with milia, or flaky? Be specific about WHERE each texture type appears.
   - Tone: Is it radiant and luminous, sallow and grey, ruddy with broken capillaries, or pale and lifeless? Mention any localized redness (around nose, on cheeks) or grey cast.
   - Hydration: Do they look dewy and plump, or tight with visible fine dehydration lines? Check forehead, under eyes, nasolabial folds. Mention specific zones that look dry vs. hydrated.
   - Pore Quality: Are pores invisible, visible only on the nose, enlarged across cheeks, or clogged and dark? Be specific about location and severity.
   - Pigmentation: ANY freckles, melasma patches across cheeks/forehead, post-acne marks, sun spots on temples or cheeks? Name the location of every pigmentation issue you see.
   - Wrinkles: Are they deep static folds, fine dynamic expression lines, or virtually absent? Name exact locations: crow's feet, forehead lines, elevens between brows, nasolabial folds, marionette lines.
   - Elasticity: Does the skin look firm and lifted with defined jawline, or is there sagging, jowling, or hollowing under eyes? Mention bounce vs. laxity.
   - Sun Damage: ANY leathering, deep creases, solar lentigines (brown spots), mottling, or telangiectasia (spider veins)? Or is the skin well-preserved?
   Write 3-5 sentences per category. Use vivid, observational language. Name specific facial zones. If you see nothing notable in a category, say so explicitly rather than writing vague filler.

4. SUMMARY — Write one powerful paragraph that synthesizes the photo evidence. Start with the most striking observation from the photo. Example: "Your photo reveals skin that is fundamentally healthy but showing early signs of photoaging — specifically, fine crow's feet and slight mottling on the cheekbones that suggests cumulative UV exposure." This summary should feel like someone actually looked at the face.

5. ROOT CAUSES — Prioritize photo-based observations over quiz answers. If the photo shows significant sun damage but the client doesn't mention sun exposure, the root cause is STILL sun damage — call it out. Connect visible signs in the photo to biological mechanisms. Be specific and use the photo as evidence.

6. LIFESTYLE RECOMMENDATIONS — Targeted, precise, actionable. Base these on BOTH photo observations and quiz data. If the photo shows dehydration lines, recommend specific hydration habits even if the client didn't mention dryness.

7. PRODUCT RECOMMENDATIONS — Match to photo observations. If the photo shows congestion and enlarged pores, recommend the Peeling Gel. If it shows dehydration lines and dullness, recommend the Serum + Night Cream. Each product must connect to a SPECIFIC visible issue in the photo.

8. EXPECTED RESULTS — Be specific and photo-driven. "Based on the dehydration lines visible across your forehead, you should see plumping within 5-7 days of consistent hydration." Not generic timelines.

9. CONSULTATION NOTE — Reference something SPECIFIC from the photo. "The congestion visible on your chin and the fine lines around your eyes are exactly the kind of concerns our specialists address daily with targeted protocols."

RULES:
- NEVER diagnose medical conditions (acne, rosacea, eczema, melanoma, etc.)
- If you see signs that need medical attention, gently suggest seeing a dermatologist
- Tone: clinical, precise, warm, confident — like a great dermatologist who has actually looked at your face under magnification
- Be HONEST and DIRECT. If their skin looks amazing, say so enthusiastically. If it looks rough, say so kindly but clearly.
- The photo is PRIMARY. Quiz is CONTEXT. When they conflict, trust your eyes.
- Every observation must reference the ACTUAL photo, not generic assumptions
- The same person with different photos should get genuinely different reports

Return ONLY valid JSON in this exact structure:
{
  "overallScore": 6,
  "scoreLabel": "Moderate — room for improvement",
  "summary": "...",
  "photoAnalysis": {
    "texture": "...",
    "tone": "...",
    "hydration": "...",
    "poreQuality": "...",
    "pigmentation": "...",
    "wrinkles": "...",
    "elasticity": "...",
    "sunDamage": "..."
  },
  "rootCauses": [
    { "factor": "...", "explanation": "..." }
  ],
  "lifestyleRecommendations": ["...", "..."],
  "productRecommendations": [
    { "product": "...", "why": "..." }
  ],
  "expectedResults": "...",
  "consultationNote": "..."
}`;

      const userPrompt = `CLIENT PROFILE:
- Age range: ${age}
- Gender: ${gender}
- Skin type (self-reported): ${skinType}
- Climate/environment: ${climate}
- Top concerns (self-reported): ${concerns.join(', ')}
- Current routine: ${routine}
- Sleep quality: ${sleep}
- Concern duration: ${duration}
- Previous treatments tried: ${treatments.length > 0 ? treatments.join(', ') : 'None reported'}
- Lifestyle factors: ${lifestyle.length > 0 ? lifestyle.join(', ') : 'None reported — client indicates a healthy lifestyle with no risk factors'}

YOU HAVE AN ATTACHED FACIAL PHOTO. THIS PHOTO IS YOUR PRIMARY SOURCE OF TRUTH.

STEP 1 — EXAMINE THE PHOTO METHODICALLY. Look at every zone: forehead, between brows, eyes (crow's feet, under-eye), cheeks, nose, nasolabial folds, chin, jawline, neck. Note EVERY visible sign: texture, tone, hydration, pores, pigmentation, wrinkles, elasticity, sun damage.

STEP 2 — WRITE YOUR REPORT BASED ON WHAT YOU SEE IN THE PHOTO. The quiz answers are helpful context but they are secondary. If the client says they have "normal skin" but the photo shows oily T-zone and visible pores — report the oily T-zone. If they say "no sun damage" but you see solar lentigines on the cheeks — report the sun damage. Your eyes are more reliable than self-reporting.

STEP 3 — BE SPECIFIC AND VIVID. Every observation should name a facial zone and describe what you see there. Do not use vague qualifiers like "mild" or "moderate" without explaining what you mean.

This person's skin is unique. The photo reveals the truth. Reflect that truth.`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zerolines.life',
          'X-Title': 'Zero Lines AI Face Analyzer',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: photoBase64,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          temperature: 0.9,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch { errorData = { raw: errorText }; }
        return new Response(
          JSON.stringify({ error: 'OpenRouter API error', status: response.status, details: errorData }),
          { status: 502, headers: corsHeaders }
        );
      }

      const aiResponse = await response.json();

      if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
        return new Response(
          JSON.stringify({ error: 'Invalid response from AI', response: aiResponse }),
          { status: 502, headers: corsHeaders }
        );
      }

      const content = aiResponse.choices[0].message.content;

      // Extract JSON from AI response (robust parsing)
      let jsonStr = content;
      let result = null;
      let parseError = null;

      // Strategy 1: Extract from markdown code blocks
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          result = JSON.parse(codeBlockMatch[1].trim());
        } catch (e) { parseError = e; }
      }

      // Strategy 2: Find the first { and last } and extract
      if (!result) {
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            result = JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
          } catch (e) { parseError = e; }
        }
      }

      // Strategy 3: Try the whole content
      if (!result) {
        try {
          result = JSON.parse(jsonStr.trim());
        } catch (e) { parseError = e; }
      }

      if (!result) {
        return new Response(
          JSON.stringify({
            error: 'Failed to parse AI response',
            parseError: parseError ? parseError.message : 'No JSON found',
            rawContent: content.substring(0, 3000)
          }),
          { status: 502, headers: corsHeaders }
        );
      }

      return new Response(JSON.stringify(result), { headers: corsHeaders });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(
        JSON.stringify({ error: 'Analysis failed. Please try again.', details: err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
