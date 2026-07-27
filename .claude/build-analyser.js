/* Generate /analyser/index.html with the extracted question data inlined, so
 * the page is self-contained and the questions cannot drift from the originals.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const questions = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'quiz-questions.json'), 'utf8'));

// "Select up to 3" is stated in the question text; enforce it in data too.
questions.forEach((q) => {
  if (q.id === 'concerns') q.max = 3;
});

const NAV = [
  ['/science', 'Science'], ['/protocol', 'Protocol'], ['/products', 'Formulations'],
  ['/story', 'Story'], ['/analyser/', 'Analyser'], ['/blog/', 'Journal'], ['/contact', 'Contact'],
];

const headerNav = NAV.map(([h, t]) => `      <a class="zl-header__link" href="${h}">${t}</a>`).join('\n');
const menuNav = NAV.map(([h, t], i) => `    <a class="zl-menu__link" href="${h}" style="--i:${i}">${t}</a>`).join('\n');

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Skin Analyser — Zero Lines</title>
<meta name="description" content="Ten questions and one photograph. The Zero Lines analyser reads texture, tone, hydration, pigmentation and the early structural signs of ageing, then returns a written assessment and a protocol matched to it.">
<link rel="canonical" href="https://zerolines.life/analyser/">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Zero Lines">
<meta property="og:title" content="Skin Analyser — Zero Lines">
<meta property="og:description" content="See your skin as we see it. Ten questions, one photograph, a full written assessment.">
<meta property="og:url" content="https://zerolines.life/analyser/">
<meta property="og:image" content="https://zerolines.life/assets/og/hero-editorial-1.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Skin Analyser — Zero Lines">
<meta name="twitter:description" content="See your skin as we see it.">
<meta name="twitter:image" content="https://zerolines.life/assets/og/hero-editorial-1.jpg">

<link rel="icon" href="/assets/logo-mark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
<section class="zl-section zl-a" id="zl-a-top" style="padding-top:calc(var(--header-h) + var(--section-y-sm))">
  <div class="zl-container">

    <!-- intro -->
    <div id="zl-a-intro">
      <div class="zl-split zl-split--wide-txt">
        <div>
          <span class="zl-eyebrow" data-reveal>Skin Analysis</span>
          <h1 class="zl-display-l" data-reveal style="--reveal-delay:80ms;margin:1.25rem 0 1.5rem;max-width:13ch">
            See your skin as we <em class="zl-em--brand">see</em> it.
          </h1>
          <p class="zl-lead" data-reveal style="--reveal-delay:160ms">
            Ten questions and one photograph. Our analyser reads texture, tone,
            hydration, pigmentation and the early structural signs of ageing — then
            returns a full written assessment and a protocol matched to it.
          </p>

          <ul class="zl-a-list" data-stagger style="margin-top:2rem">
            <li>Ten quick questions about your skin and your habits</li>
            <li>One clear photograph, in natural light, without make-up</li>
            <li>A written assessment across eight markers</li>
          </ul>

          <div data-reveal style="--reveal-delay:280ms;margin-top:2.5rem">
            <button class="zl-btn zl-btn--brand" type="button" id="zl-a-start">Begin the analysis</button>
          </div>
          <p class="zl-muted" data-reveal style="--reveal-delay:340ms;margin-top:1.5rem;font-size:.75rem">
            Your photograph is sent for analysis and discarded. It is never stored.
          </p>
        </div>

        <div class="zl-media zl-media--portrait" data-reveal="wipe" style="--reveal-delay:180ms">
          <img src="/assets/hero-model-young-south-asian-woman.webp" alt="Portrait study of skin in natural light" width="1080" height="1440">
        </div>
      </div>
    </div>

    <!-- questions -->
    <div id="zl-a-quiz" hidden>
      <div class="zl-a-stage">
        <span id="zl-a-progress"></span>
        <div id="zl-a-question"></div>
        <div class="zl-a-nav">
          <button class="zl-btn zl-btn--ghost" type="button" id="zl-a-back">Back</button>
          <button class="zl-btn zl-btn--brand" type="button" id="zl-a-next">Continue</button>
        </div>
      </div>
    </div>

    <!-- photo -->
    <div id="zl-a-photo" hidden>
      <div class="zl-a-stage">
        <span class="zl-eyebrow">Final step</span>
        <h2 class="zl-display-m" style="margin:1.25rem 0 1rem">Upload a photograph of your face.</h2>
        <p class="zl-lead" style="margin-bottom:2rem">
          Natural light, no make-up, face centred and looking straight at the camera.
          The more honest the photograph, the more useful the assessment.
        </p>

        <div class="zl-a-drop" id="zl-a-drop" role="button" tabindex="0"
             aria-label="Choose a photograph to upload">
          <svg class="zl-a-drop__icon" width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.25" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span>Choose a photograph, or drag one here</span>
          <span class="zl-a-drop__hint">JPG or PNG</span>
        </div>
        <input type="file" id="zl-a-file" accept="image/*" class="zl-sr">

        <div class="zl-a-preview" id="zl-a-preview" hidden>
          <!-- transparent placeholder so the element is never a src-less <img>,
               which browsers report as a broken image before a photo is chosen -->
          <img id="zl-a-preview-img" alt="Your uploaded photograph"
               src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
          <button class="zl-link" type="button" id="zl-a-retake">Choose a different photograph</button>
        </div>

        <p class="zl-form__status" id="zl-a-photo-error" data-state="err" role="alert"></p>

        <div class="zl-a-nav">
          <button class="zl-btn zl-btn--brand" type="button" id="zl-a-analyse" disabled>Analyse my skin</button>
        </div>
      </div>
    </div>

    <!-- working -->
    <div id="zl-a-working" hidden>
      <div class="zl-a-stage">
        <div class="zl-a-pulse" aria-hidden="true"></div>
        <h2 class="zl-display-m" style="margin:1.75rem 0 .75rem">Analysing your skin.</h2>
        <p class="zl-lead">This takes around half a minute. Please stay on the page.</p>
        <ul class="zl-a-steps" id="zl-a-steps" aria-live="polite"></ul>
      </div>
    </div>

    <!-- results -->
    <div id="zl-a-results" hidden>
      <div class="zl-a-stage zl-a-stage--wide">
        <span class="zl-eyebrow">Your report</span>
        <h2 class="zl-display-l" style="margin:1.25rem 0 2.5rem">Skin Longevity Report</h2>
        <div id="zl-a-report" aria-live="polite"></div>

        <div class="zl-a-note" style="margin-top:3rem">
          <p style="margin-bottom:1.25rem">
            <strong>Want a closer look?</strong> Our specialists can review this report
            with you and build a protocol around it.
          </p>
          <div style="display:flex;gap:1rem;flex-wrap:wrap">
            <a class="zl-btn zl-btn--brand" href="https://wa.me/35054005198">Talk to a specialist</a>
            <a class="zl-btn zl-btn--ghost" href="/protocol">See the protocol</a>
          </div>
        </div>

        <div style="margin-top:2.5rem">
          <button class="zl-link" type="button" id="zl-a-restart">Start a new analysis</button>
        </div>
      </div>
    </div>

    <!-- error -->
    <div id="zl-a-error" hidden>
      <div class="zl-a-stage">
        <span class="zl-eyebrow">Analysis unavailable</span>
        <h2 class="zl-display-m" style="margin:1.25rem 0 1rem">We could not complete your analysis.</h2>
        <p class="zl-lead" style="margin-bottom:.75rem" id="zl-a-error-msg"></p>
        <p class="zl-lead">
          Rather than show you a generated placeholder, we would rather tell you
          plainly. Please try again in a moment — or send us your photograph directly
          and a specialist will review it themselves.
        </p>
        <div class="zl-a-nav">
          <button class="zl-btn zl-btn--brand" type="button" id="zl-a-retry">Try again</button>
          <a class="zl-btn zl-btn--ghost" href="https://wa.me/35054005198">Message a specialist</a>
        </div>
      </div>
    </div>

  </div>
</section>
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
      <span>© 2026 Zero Lines. Gibraltar &amp; Barcelona.</span>
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
  <span>We use cookies to understand how the site is used. <a href="/cookies.html" style="color:#fff;text-decoration:underline">Learn more</a></span>
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
