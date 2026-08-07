/* Generate /analyser/index.html.
 *
 * The ten questions and their options are inlined from .claude/quiz-questions.json
 * so the page is self-contained and the wording cannot drift from the original.
 * Do not hand-edit analyser/index.html — edit this file and re-run:
 *
 *     node .claude/build-analyser.js
 *
 * The engine is /assets/zl-analyser.js and the styles are /assets/zl-analyser.css.
 * The Cloudflare Worker contract is unchanged: POST { answers, photoBase64 }.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const questions = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'quiz-questions.json'), 'utf8'));

/* Short titles for the consultation rail. These label the step in the sidebar;
 * the question text and every option are left exactly as authored. */
const RAIL = {
  age: 'Age', gender: 'You', skinType: 'Skin type', climate: 'Climate',
  concerns: 'Concerns', sleep: 'Sleep', routine: 'Routine',
  treatments: 'History', duration: 'Duration', lifestyle: 'Lifestyle',
};

questions.forEach((q) => {
  // "Select up to 3" is stated in the question text; enforce it in data too.
  if (q.id === 'concerns') q.max = 3;
  q.short = RAIL[q.id] || q.id;
});

const NAV = [
  ['/science', 'Science'], ['/protocol', 'Protocol'], ['/products', 'Formulations'],
  ['/story', 'Story'], ['/analyser/', 'Analyser'], ['/blog/', 'Journal'], ['/contact', 'Contact'],
];

const headerNav = NAV.map(([h, t]) => `      <a class="zl-header__link" href="${h}">${t}</a>`).join('\n');
const menuNav = NAV.map(([h, t], i) => `    <a class="zl-menu__link" href="${h}" style="--i:${i}">${t}</a>`).join('\n');

/* 1x1 transparent GIF. Preview and scan images are never src-less <img>, which
 * browsers report as broken before a photograph has been chosen. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const GUIDE = [
  {
    icon: '<rect x="4" y="3" width="16" height="18"/><path d="M12 3v18M4 12h16"/>',
    title: 'Daylight, not lamplight',
    text: 'Stand facing a window in the middle of the day. Overhead bulbs carve shadow into every line and read as texture that is not there.',
  },
  {
    icon: '<path d="M12 3c4.4 0 7 3.4 7 8s-2.9 10-7 10-7-5.4-7-10 2.6-8 7-8Z"/><path d="M9 20.4c1.8.8 4.2.8 6 0"/>',
    title: 'A bare face',
    text: 'No make-up, no filter, no smoothing. Foundation is designed to hide precisely what the assessment is trying to see.',
  },
  {
    icon: '<rect x="3" y="6" width="18" height="13" rx="1"/><circle cx="12" cy="12.5" r="3.5"/><path d="M9 6l1.4-2h3.2L15 6"/>',
    title: 'Camera at eye level',
    text: 'Straight to the lens, whole face in frame, hair back. Held high or low, the jaw and brow both distort.',
  },
  {
    icon: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.6h7"/><circle cx="9.2" cy="10" r=".7" fill="currentColor" stroke="none"/><circle cx="14.8" cy="10" r=".7" fill="currentColor" stroke="none"/>',
    title: 'A resting face',
    text: 'Relaxed, not smiling. Expression lines are the point of the exercise, and a smile hides half of them.',
  },
];

const guideHtml = GUIDE.map((g, i) => `        <div class="zl-a-guide__item">
          <svg class="zl-a-guide__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" aria-hidden="true">${g.icon}</svg>
          <h3 class="zl-a-guide__t">${g.title}</h3>
          <p class="zl-a-guide__d">${g.text}</p>
        </div>`).join('\n');

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Skin Analyser — Zero Lines | A Written Assessment of Your Skin</title>
<meta name="description" content="Ten questions and one photograph. The Zero Lines analyser reads texture, tone, hydration, pores, pigmentation, lines, elasticity and sun exposure, then returns a written assessment and the protocol that follows from it.">
<link rel="canonical" href="https://zerolines.life/analyser/">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Zero Lines">
<meta property="og:title" content="Skin Analyser — Zero Lines">
<meta property="og:description" content="See your skin as we see it. Ten questions, one photograph, a full written assessment across eight markers.">
<meta property="og:url" content="https://zerolines.life/analyser/">
<meta property="og:image" content="https://zerolines.life/assets/og/hero-editorial-1.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Skin Analyser — Zero Lines">
<meta name="twitter:description" content="See your skin as we see it.">
<meta name="twitter:image" content="https://zerolines.life/assets/og/hero-editorial-1.jpg">

<link rel="icon" href="/assets/logo-mark.png">
<link rel="apple-touch-icon" href="/assets/logo-mark.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="image" href="/assets/hero-model-young-south-asian-woman.webp" fetchpriority="high">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/zl.css">
<link rel="stylesheet" href="/assets/zl-analyser.css">
</head>

<body>
<a class="zl-skip" href="#main">Skip to main content</a>
<div class="zl-progress" aria-hidden="true"></div>

<header class="zl-header">
  <div class="zl-header__inner">
    <a class="zl-logo" href="/">Zero Lines</a>
    <nav class="zl-header__nav" aria-label="Primary">
${headerNav}
    </nav>
    <button class="zl-burger" aria-label="Open menu" aria-expanded="false" aria-controls="zl-menu"><span></span></button>
  </div>
</header>

<div class="zl-menu" id="zl-menu" data-open="false">
  <nav class="zl-menu__list" aria-label="Mobile">
${menuNav}
  </nav>
  <div class="zl-menu__meta">
    <a class="zl-link" href="https://wa.me/35054005198">WhatsApp</a>
    <a class="zl-link" href="mailto:info@zerolines.life">info@zerolines.life</a>
  </div>
</div>

<main id="main">
<div class="zl-a" id="zl-a-top">

<!-- ════ 1. THE OPENING — what happens, and what becomes of the photograph ══ -->
<div class="zl-a-panel" id="zl-a-intro">

  <section class="zl-a-hero">
    <div class="zl-container">
      <div class="zl-split zl-split--wide-txt" style="align-items:center">
        <div>
          <span class="zl-eyebrow" data-reveal>The Skin Analysis</span>

          <h1 class="zl-display-xl" style="margin:1.5rem 0 0;max-width:11ch">
            <span class="zl-rise" style="--reveal-delay:80ms"><span>See your skin</span></span>
            <span class="zl-rise" style="--reveal-delay:200ms"><span>as we <em class="zl-em--brand">see</em> it.</span></span>
          </h1>

          <p class="zl-lead" data-reveal style="--reveal-delay:560ms;margin-top:1.75rem;max-width:44ch">
            Ten questions, then one photograph. What comes back is a written
            assessment of how your skin presents today — read across eight
            markers, with what appears to be driving them and the formulations
            that follow.
          </p>

          <div data-reveal style="--reveal-delay:680ms;margin-top:2.25rem;display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
            <button class="zl-btn zl-btn--brand" type="button" id="zl-a-start">Begin the analysis</button>
            <span class="zl-a-meta">About two minutes<br>No account, no email address</span>
          </div>
        </div>

        <div class="zl-media zl-media--portrait" data-reveal="wipe" style="--reveal-delay:220ms">
          <img src="/assets/hero-model-young-south-asian-woman.webp"
               alt="A portrait study of skin in flat natural daylight"
               width="1080" height="1440" fetchpriority="high" data-parallax="0.05">
        </div>
      </div>
    </div>
  </section>

  <section class="zl-section zl-section--sm zl-tint">
    <div class="zl-container">
      <div class="zl-index-rule" data-reveal>
        <span class="zl-index-rule__num">01</span>
        <span class="zl-eyebrow zl-eyebrow--bare">What Happens</span>
      </div>

      <div class="zl-grid zl-grid--3" data-stagger>
        <div class="zl-a-open__item">
          <span class="zl-num" data-count="10">10</span><span class="zl-a-open__unit">questions</span>
          <h3 class="zl-display-s">You describe it</h3>
          <p>
            Skin type, climate, sleep, the routine you actually keep and what you
            have tried before. Nothing that identifies you is asked for.
          </p>
        </div>
        <div class="zl-a-open__item">
          <span class="zl-num" data-count="1">1</span><span class="zl-a-open__unit">photograph</span>
          <h3 class="zl-display-s">The skin shows it</h3>
          <p>
            Daylight, no make-up, straight to the camera. The questions say how
            your skin behaves; the photograph shows how it presents.
          </p>
        </div>
        <div class="zl-a-open__item">
          <span class="zl-num" data-count="8">8</span><span class="zl-a-open__unit">markers</span>
          <h3 class="zl-display-s">We write it out</h3>
          <p>
            Texture, tone, hydration, pores, pigmentation, lines, elasticity and
            sun exposure — each written out, then the protocol that follows.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="zl-section zl-section--sm zl-brand-field">
    <div class="zl-container">
      <div class="zl-split" style="align-items:center">
        <div>
          <span class="zl-eyebrow" data-reveal>Your Photograph</span>
          <h2 class="zl-display-m" data-reveal style="--reveal-delay:80ms;margin-top:1.25rem;max-width:15ch">
            What becomes of the <em class="zl-em">picture</em>.
          </h2>
          <hr class="zl-rule zl-draw" style="max-width:90px;margin-top:2rem;background:var(--signal);height:2px">
        </div>

        <div data-stagger>
          <ul class="zl-a-pledge">
            <li>It is sent over an encrypted connection to the service that reads it.</li>
            <li>It is read once, for this assessment, and is not stored afterwards.</li>
            <li>It is not attached to a name. The analyser asks for no account, no email address and no payment.</li>
            <li>It is never published, never shared with anyone else, and never used for advertising.</li>
          </ul>

          <p class="zl-a-fine" style="margin-top:2rem">
            The assessment describes the <em>appearance</em> of your skin and
            suggests a routine. It is not a medical diagnosis and it does not
            replace advice from a healthcare professional. If something on your
            skin concerns you medically, please see a doctor.
          </p>

          <div style="margin-top:2.25rem">
            <button class="zl-btn zl-btn--on-brand" type="button" id="zl-a-start-2">Begin the analysis</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- ════ 2. THE CONSULTATION — ten questions, one at a time ═══════════════ -->
<div class="zl-a-panel" id="zl-a-quiz" hidden>
  <section class="zl-a-section">
    <div class="zl-container">
      <div class="zl-a-consult">

        <aside class="zl-a-rail">
          <span class="zl-a-rail__label">The consultation</span>
          <ol class="zl-a-rail__list" id="zl-a-rail"></ol>
        </aside>

        <div class="zl-a-main">
          <div class="zl-a-meter" id="zl-a-meter">
            <span class="zl-a-meter__count" id="zl-a-count" role="status" aria-live="polite">Question 1 of ${questions.length}</span>
            <span class="zl-a-meter__name" id="zl-a-stepname"></span>
          </div>

          <div id="zl-a-question"></div>

          <div class="zl-a-nav">
            <button class="zl-btn zl-btn--ghost" type="button" id="zl-a-back">Back</button>
            <button class="zl-btn zl-btn--brand" type="button" id="zl-a-next">Continue</button>
            <span class="zl-a-nav__hint" id="zl-a-nav-hint"></span>
          </div>
        </div>

      </div>
    </div>
  </section>
</div>

<!-- ════ 3. THE PHOTOGRAPH ════════════════════════════════════════════════ -->
<div class="zl-a-panel" id="zl-a-photo" hidden>
  <section class="zl-a-section">
    <div class="zl-container">
      <div class="zl-a-stage">
        <span class="zl-eyebrow">The Photograph</span>
        <h2 class="zl-display-l" id="zl-a-photo-h" tabindex="-1" style="margin:1.25rem 0 1.5rem;max-width:13ch">
          One clear <em class="zl-em--brand">photograph</em>.
        </h2>
        <p class="zl-lead">
          This is the half of the assessment you cannot answer in words. Four
          things separate a useful reading from a guess.
        </p>

        <div class="zl-a-guide">
${guideHtml}
        </div>

        <p class="zl-a-avoid">
          No flash, no filters, no sunglasses, no heavy shadow across one side of
          the face. If you are unsure, take two and send the plainer one.
        </p>

        <div class="zl-a-drop" id="zl-a-drop" role="button" tabindex="0"
             aria-label="Choose a photograph of your face to upload">
          <svg class="zl-a-drop__icon" width="30" height="30" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.15" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span class="zl-a-drop__label">Choose a photograph, or drag one here</span>
          <span class="zl-a-drop__hint">JPG, PNG or HEIC — resized in your browser before it is sent</span>
        </div>
        <input type="file" id="zl-a-file" accept="image/*" class="zl-sr">

        <div class="zl-a-preview" id="zl-a-preview" hidden>
          <div class="zl-a-frame">
            <img id="zl-a-preview-img" alt="The photograph you have chosen" src="${BLANK}">
          </div>
          <div>
            <p class="zl-a-preview__t">Is this the photograph?</p>
            <p class="zl-a-preview__d" id="zl-a-preview-meta">
              Check that the whole face is in frame, in focus, and lit from the front.
            </p>
            <button class="zl-link" type="button" id="zl-a-retake">Choose a different one <span class="zl-link__arrow" aria-hidden="true">→</span></button>
          </div>
        </div>

        <p class="zl-form__status" id="zl-a-photo-error" data-state="err" role="alert"></p>

        <div class="zl-a-nav">
          <button class="zl-btn zl-btn--ghost" type="button" id="zl-a-photo-back">Back to the questions</button>
          <button class="zl-btn zl-btn--brand" type="button" id="zl-a-analyse" disabled>Read my skin</button>
        </div>

        <p class="zl-a-fine" style="margin-top:2rem">
          Your photograph is read once for this assessment and is not stored.
          It is not attached to a name, and nothing here asks you to create an account.
        </p>
      </div>
    </div>
  </section>
</div>

<!-- ════ 4. THE WAIT — the reading itself, rather than a spinner ══════════ -->
<div class="zl-a-panel" id="zl-a-working" hidden>
  <section class="zl-a-section">
    <div class="zl-container">
      <div class="zl-a-work">
        <div class="zl-a-scan">
          <img id="zl-a-scan-img" alt="" src="${BLANK}">
          <span class="zl-a-scan__grid" aria-hidden="true"></span>
          <span class="zl-a-scan__sweep" aria-hidden="true"></span>
          <span class="zl-a-scan__frame" aria-hidden="true"></span>
        </div>

        <div>
          <span class="zl-eyebrow">The Reading</span>
          <h2 class="zl-display-m" id="zl-a-working-h" tabindex="-1" style="margin:1.25rem 0 1.25rem;max-width:14ch">
            Your skin is being <em class="zl-em--brand">read</em>.
          </h2>
          <p class="zl-lead" style="max-width:42ch">
            Eight markers, one at a time, against everything you have just told
            us. It usually takes around half a minute — please stay on the page.
          </p>

          <ul class="zl-a-markers" id="zl-a-markers"></ul>

          <p class="zl-a-working__status" id="zl-a-working-status" role="status" aria-live="polite">Beginning the reading.</p>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- ════ 5. THE ASSESSMENT ════════════════════════════════════════════════ -->
<div class="zl-a-panel" id="zl-a-results" hidden>
  <section class="zl-a-section">
    <div class="zl-container">
      <article class="zl-a-report">
        <header class="zl-a-rhead">
          <span class="zl-eyebrow">Skin Longevity Assessment</span>
          <h2 class="zl-display-l" id="zl-a-results-h" tabindex="-1" style="margin-top:1.25rem;max-width:14ch">
            Your written <em class="zl-em--brand">assessment</em>.
          </h2>
          <p class="zl-a-rmeta"><span id="zl-a-date"></span> · Prepared by the Zero Lines analyser</p>
        </header>

        <div class="zl-a-report__body" id="zl-a-report"></div>

        <div class="zl-a-note">
          <p>
            <strong>Would you like this read with you?</strong> Our specialists
            will go through the assessment, answer what it raises, and set the
            protocol against your own week rather than a general one.
          </p>
          <p class="zl-a-fine" style="margin-top:1.25rem">
            This assessment describes the appearance of your skin. It is not a
            medical diagnosis and does not replace advice from a healthcare
            professional. The Zero Lines collection is in pre-launch and is not
            yet available to purchase.
          </p>
        </div>

        <div class="zl-a-close">
          <div class="zl-a-close__actions">
            <a class="zl-btn zl-btn--brand" href="https://wa.me/35054005198?text=Hello%20Zero%20Lines%2C%20I%20have%20just%20completed%20the%20skin%20analysis%20and%20would%20like%20to%20talk%20it%20through.">Talk it through with a specialist</a>
            <a class="zl-btn zl-btn--ghost" href="/protocol">See the full protocol</a>
          </div>
          <div class="zl-a-close__row">
            <button class="zl-link" type="button" id="zl-a-print">Print or save as PDF <span class="zl-link__arrow" aria-hidden="true">→</span></button>
            <button class="zl-link" type="button" id="zl-a-restart">Start a new analysis <span class="zl-link__arrow" aria-hidden="true">→</span></button>
            <a class="zl-link" href="/#waitlist">Register for early access <span class="zl-link__arrow" aria-hidden="true">→</span></a>
          </div>
        </div>
      </article>
    </div>
  </section>
</div>

<!-- ════ 6. WHEN IT FAILS — the truth, never a fabricated report ══════════ -->
<div class="zl-a-panel" id="zl-a-error" hidden>
  <section class="zl-a-section">
    <div class="zl-container">
      <div class="zl-a-stage">
        <span class="zl-eyebrow">Analysis Unavailable</span>
        <h2 class="zl-display-l" id="zl-a-error-h" tabindex="-1" style="margin:1.25rem 0 1.5rem;max-width:15ch">
          We could not read your skin just <em class="zl-em--brand">now</em>.
        </h2>
        <p class="zl-lead">
          Something between this page and our analysis service did not answer.
          Your answers are still held on this page, so trying again costs you
          nothing but a moment.
        </p>
        <p class="zl-lead" style="margin-top:1.25rem">
          We will not invent a report to fill the gap. An assessment of your own
          face is worth having only if it was actually read — so rather than show
          you something generated, we would rather tell you plainly, and offer
          you a person instead.
        </p>

        <p class="zl-a-err__detail" id="zl-a-error-msg" hidden></p>

        <div class="zl-a-nav">
          <button class="zl-btn zl-btn--brand" type="button" id="zl-a-retry">Try again</button>
          <a class="zl-btn zl-btn--ghost" href="https://wa.me/35054005198?text=Hello%20Zero%20Lines%2C%20the%20skin%20analyser%20could%20not%20complete%20my%20analysis.%20May%20I%20send%20you%20my%20photograph%3F">Send it to a specialist instead</a>
          <button class="zl-link" type="button" id="zl-a-error-photo">Choose a different photograph <span class="zl-link__arrow" aria-hidden="true">→</span></button>
        </div>

        <p class="zl-a-fine" style="margin-top:2rem">
          Or write to <a href="mailto:info@zerolines.life" style="color:var(--house);text-decoration:underline;text-underline-offset:.2em">info@zerolines.life</a>
          and a specialist will review your photograph themselves.
        </p>
      </div>
    </div>
  </section>
</div>

</div>
</main>

<footer class="zl-footer zl-on-dark">
  <div class="zl-container">
    <div class="zl-footer__top">
      <div class="zl-footer__brand">
        <span class="zl-logo">Zero Lines</span>
        <p style="margin-top:1.25rem;max-width:32ch;font-size:.875rem;line-height:1.7">
          A clinical-luxury Skin Longevity House. Botanical science, Pyrenean
          mineral complexes, and formulations made in Barcelona.
        </p>
      </div>
      <div>
        <h3>Explore</h3>
        <div class="zl-footer__links">
          <a href="/science">Science</a><a href="/protocol">Protocol</a>
          <a href="/products">Formulations</a><a href="/story">Story</a><a href="/blog/">Journal</a>
        </div>
      </div>
      <div>
        <h3>Contact</h3>
        <div class="zl-footer__links">
          <a href="/contact">Get in touch</a>
          <a href="https://wa.me/35054005198">WhatsApp</a>
          <a href="mailto:info@zerolines.life">info@zerolines.life</a>
          <a href="https://instagram.com/zerolines.life">Instagram</a>
        </div>
      </div>
      <div>
        <h3>Information</h3>
        <div class="zl-footer__links">
          <a href="/faq.html">FAQ</a><a href="/shipping-returns.html">Shipping &amp; returns</a>
          <a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a>
          <a href="/accessibility.html">Accessibility</a>
        </div>
      </div>
    </div>
    <div class="zl-footer__bottom">
      <span>© 2026 Zero Lines. Gibraltar &middot; Andorra &middot; Marbella.</span>
      <div class="zl-footer__legal">
        <a href="/cookies.html">Cookies</a><a href="/accessibility.html">Accessibility</a>
      </div>
    </div>
  </div>
</footer>

<a class="zl-wa" href="https://wa.me/35054005198" aria-label="Contact Zero Lines on WhatsApp">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
</a>

<div class="zl-cookie" id="zl-cookie" data-open="false" role="region" aria-label="Cookie notice">
  <span>We use cookies to understand how the site is used. <a href="/cookies.html">Learn more</a></span>
  <div class="zl-cookie__actions">
    <button class="zl-btn zl-btn--on-dark-ghost" data-cookie="essential">Essential only</button>
    <button class="zl-btn zl-btn--light" data-cookie="all">Accept all</button>
  </div>
</div>

<script type="application/json" id="zl-quiz-data">${JSON.stringify(questions)}</script>
<script src="/assets/lenis.min.js" defer></script>
<script src="/assets/zl.js" defer></script>
<script src="/assets/zl-analyser.js" defer></script>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {});
    });
  }
</script>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'analyser'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'analyser', 'index.html'), html);
console.log(`wrote analyser/index.html with ${questions.length} questions inlined`);
