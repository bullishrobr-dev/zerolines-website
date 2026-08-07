/* ============================================================================
   restyle-blog.js — lift the 31-file Journal onto the Zero Lines v2 system.

   The blog was authored as a self-contained mini-site: its own Playfair/blog.css
   type stack, its own header and footer duplicated into every file, its own
   scroll-progress bar and back-to-top button, an SPA-era nav pointing at
   `/#/quiz`, and Unsplash .jpg thumbnails that have nothing to do with the brand
   photography in /assets.

   Doing that by hand across 31 files is how inconsistencies get baked in, so
   this script performs the whole migration deterministically:

     head    → Cormorant Garamond + Inter, /assets/zl.css then /blog/blog.css
     chrome  → the canonical .zl-header / #zl-menu / .zl-footer / cookie / WhatsApp
     links   → every /#/hash-route becomes a real path, every href absolute
     images  → every images/unsplash/*.jpg becomes a brand /assets/*.webp
     motion  → data-reveal / wipe / stagger / draw / parallax across the article
     claims  → the four unsubstantiated clinical statements are rewritten

   Article body copy — the 29,000 words — is not touched beyond those points.

   Run:  node .claude/restyle-blog.js
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');

/* ---------- 1. Canonical chrome, copied verbatim from index.html ---------- */

const HEAD_LINKS = `<link rel="icon" href="/assets/logo-mark.png">
<link rel="apple-touch-icon" href="/assets/logo-mark.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/zl.css">
<link rel="stylesheet" href="/blog/blog.css">
`;

const HEADER = `<a class="zl-skip" href="#main">Skip to main content</a>
<div class="zl-progress" aria-hidden="true"></div>

<header class="zl-header">
  <div class="zl-header__inner">
    <a class="zl-logo" href="/">Zero Lines</a>
    <nav class="zl-header__nav" aria-label="Primary">
      <a class="zl-header__link" href="/science">Science</a>
      <a class="zl-header__link" href="/protocol">Protocol</a>
      <a class="zl-header__link" href="/products">Formulations</a>
      <a class="zl-header__link" href="/story">Story</a>
      <a class="zl-header__link" href="/analyser/">Analyser</a>
      <a class="zl-header__link" href="/blog/">Journal</a>
      <a class="zl-header__link" href="/contact">Contact</a>
    </nav>
    <button class="zl-burger" aria-label="Open menu" aria-expanded="false" aria-controls="zl-menu"><span></span></button>
  </div>
</header>

<div class="zl-menu" id="zl-menu" data-open="false">
  <nav class="zl-menu__list" aria-label="Mobile">
    <a class="zl-menu__link" href="/science"   style="--i:0">Science</a>
    <a class="zl-menu__link" href="/protocol"  style="--i:1">Protocol</a>
    <a class="zl-menu__link" href="/products"  style="--i:2">Formulations</a>
    <a class="zl-menu__link" href="/story"     style="--i:3">Story</a>
    <a class="zl-menu__link" href="/analyser/" style="--i:4">Analyser</a>
    <a class="zl-menu__link" href="/blog/"     style="--i:5">Journal</a>
    <a class="zl-menu__link" href="/contact"   style="--i:6">Contact</a>
  </nav>
  <div class="zl-menu__meta">
    <a class="zl-link" href="https://wa.me/35054005198">WhatsApp</a>
    <a class="zl-link" href="mailto:info@zerolines.life">info@zerolines.life</a>
  </div>
</div>`;

const FOOTER = `<footer class="zl-footer zl-on-dark">
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
          <a href="/science">Science</a>
          <a href="/protocol">Protocol</a>
          <a href="/products">Formulations</a>
          <a href="/story">Story</a>
          <a href="/blog/">Journal</a>
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
          <a href="/faq.html">FAQ</a>
          <a href="/shipping-returns.html">Shipping &amp; returns</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="/accessibility.html">Accessibility</a>
        </div>
      </div>
    </div>
    <div class="zl-footer__bottom">
      <span>© 2026 Zero Lines. Gibraltar &middot; Andorra &middot; Marbella.</span>
      <div class="zl-footer__legal">
        <a href="/cookies.html">Cookies</a>
        <a href="/accessibility.html">Accessibility</a>
      </div>
    </div>
  </div>
</footer>`;

const TAIL = `<a class="zl-wa" href="https://wa.me/35054005198" aria-label="Contact Zero Lines on WhatsApp">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
</a>

<div class="zl-cookie" id="zl-cookie" data-open="false" role="region" aria-label="Cookie notice">
  <span>We use cookies to understand how the site is used. <a href="/cookies.html" style="color:#fff;text-decoration:underline">Learn more</a></span>
  <div class="zl-cookie__actions">
    <button class="zl-btn zl-btn--on-dark-ghost" data-cookie="essential">Essential only</button>
    <button class="zl-btn zl-btn--light" data-cookie="all">Accept all</button>
  </div>
</div>

<script src="/assets/lenis.min.js" defer></script>
<script src="/assets/zl.js" defer></script>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {});
    });
  }
</script>`;

/* The journal index keeps a category filter and a search field. Everything else
   the old inline scripts did (scroll bar, back-to-top, fade observer) is now
   zl.js's job, so only the filtering survives — rewritten without the globals
   leaking more than the two inline handlers in the markup require. */
const INDEX_SCRIPT = `<script>
  (function () {
    var category = 'all';
    var query = '';

    function apply() {
      var q = query.toLowerCase().trim();
      var shown = 0;
      var cards = document.querySelectorAll('#blog-grid .zl-blog-landing-card');
      Array.prototype.forEach.call(cards, function (card) {
        var cat = card.getAttribute('data-category') || '';
        var pick = function (sel) {
          var el = card.querySelector(sel);
          return el ? el.textContent : '';
        };
        var haystack = (pick('.zl-blog-landing-card-title') + ' ' +
                        pick('.zl-blog-landing-card-excerpt') + ' ' +
                        pick('.zl-blog-landing-card-meta span')).toLowerCase();
        var ok = (category === 'all' || cat === category) && (!q || haystack.indexOf(q) > -1);
        card.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      var empty = document.getElementById('blog-empty');
      if (empty) empty.hidden = shown > 0;
    }

    window.filterPosts = function (next) {
      category = next;
      Array.prototype.forEach.call(document.querySelectorAll('.zl-blog-category-btn'), function (btn) {
        var label = btn.textContent.toLowerCase().trim();
        var match = next === 'all' ? label === 'all' : label.indexOf(next) === 0;
        btn.classList.toggle('active', match);
        btn.setAttribute('aria-pressed', match ? 'true' : 'false');
      });
      apply();
    };

    window.handleSearch = function (value) { query = value; apply(); };
  })();
</script>`;

/* ---------- 2. Unsplash stock → brand photography ------------------------ *
   The journal shipped with 23 distinct Unsplash frames. None of them are the
   brand's own photography, and every one is a .jpg. Each is mapped to the
   closest asset in /assets, keyed on the Unsplash id with a few overrides
   where the same frame was reused under a different alt. */

const ID_MAP = {
  'photo-1464822759023': 'story-alpine-spring-water',
  'photo-1504198266287': 'hero-model-young-latina',
  'photo-1504386106331': 'story-pyrenees-to-sea',
  'photo-1504608524841': 'atmosphere-morning-ritual',
  'photo-1505118380757': 'science-bubbles-macro',
  'photo-1506126613408': 'atmosphere-spa-ritual',
  'photo-1506905925346': 'story-pyrenean-mountains-dawn',
  'photo-1515377905703': 'atmosphere-daily-ritual',
  'photo-1515894203077': 'science-hero-dna-cellular',
  'photo-1519681393784': 'story-pyrenees',
  'photo-1520206183501': 'night-sleeping-woman',
  'photo-1523362628745': 'story-springs',
  'photo-1532094349884': 'story-laboratory',
  'photo-1532187863486': 'science-peptide-molecular',
  'photo-1544367567':    'hero-model-young-southeast-asian-woman',
  'photo-1556228578':    'atmosphere-application-ritual',
  'photo-1559757175':    'science-researcher-lab',
  'photo-1576086213369': 'science-peptides',
  'photo-1583422409516': 'story-barcelona-architecture',
  'photo-1585435557343': 'science-minerals',
  'photo-1596755389378': 'atmosphere-cream-texture',
  'photo-1598440947619': 'science-skin-macro-droplets',
  'photo-1616394584738': 'science-dna',
  'photo-1620916566398': 'hero-peeling-facial',
};

// `${unsplashId}|${lowercased alt}` → asset, for frames reused across topics
const ALT_MAP = {
  'photo-1515894203077|routine': 'atmosphere-daily-ritual',
  'photo-1515894203077|morning routine': 'atmosphere-morning-ritual',
  'photo-1596755389378|skin analysis': 'atmosphere-neck-skin-detail',
  'photo-1523362628745|water': 'story-springs',
};

function unsplashId(src) {
  const m = src.match(/photo-\d+/);
  return m ? m[0] : null;
}

function assetFor(src, alt) {
  const id = unsplashId(src);
  if (!id) return null;
  if (alt) {
    const hit = ALT_MAP[id + '|' + String(alt).toLowerCase().trim()];
    if (hit) return hit;
  }
  return ID_MAP[id] || null;
}

/* ---------- 3. Claim hygiene --------------------------------------------- *
   The brand has not launched and has run no trials, so completed-trial numbers
   and "clinically reviewed" badges cannot be substantiated. Mechanism language
   replaces them. The critique of those very terms inside read-skincare-label.html
   is editorial and is deliberately left alone. */

const CLAIM_FIXES = [
  // hero trust bar + author badge
  [/Clinically reviewed/g, 'Written in-house'],
  [/Clinically Reviewed/g, 'Referenced &amp; sourced'],
  // a body that does not exist, cited as if it did
  [/Zero Lines Clinical Advisory Board/g, 'Zero Lines Formulation Team'],
  // completed-trial percentages on unlaunched products
  [/Clinical measurements from our testing panel showed up to 34% improvement in collagen density over 12 weeks\. But perhaps more importantly, participants reported skin that felt structurally different — firmer, more resilient, less prone to the "crepey" texture that characterises advanced collagen loss\./g,
   'The formulation is designed to support the skin’s own collagen synthesis rather than to fill a line for the evening. What that is intended to produce is structural rather than cosmetic — skin that feels firmer and more resilient, and is less prone to the “crepey” texture that characterises advanced collagen loss.'],
  [/Clinical measurements show up to 34% improvement in collagen density over 12 weeks of consistent use\. But the real difference most people notice first is structural: skin that feels firmer, holds hydration better, and bounces back when pressed\./g,
   'It is formulated to support collagen synthesis over a sustained programme of use rather than to blur a line overnight. The intended difference is structural: skin that feels firmer, holds hydration better, and bounces back when pressed.'],
  [/ Clinical measurements show up to 34% improvement in collagen density over 12 weeks\./g,
   ' Formulated to support the skin’s own collagen synthesis over a sustained programme of use.'],
  // the analyser returns a written assessment; it is not a medical opinion
  [/a complete dermatologist-style report/g, 'a complete written assessment'],
  [/dermatologist-style report/g, 'written skin assessment'],
];

/* ---------- 4. Legacy SPA routes ----------------------------------------- */

const ROUTE_FIXES = [
  [/\/#\/quiz/g, '/analyser/'],
  [/\/#\/analyser/g, '/analyser/'],
  [/\/#\/analyzer/g, '/analyser/'],
  [/\/#\/science/g, '/science'],
  [/\/#\/protocol/g, '/protocol'],
  [/\/#\/story/g, '/story'],
  [/\/#\/contact/g, '/contact'],
  [/\/#\/testimonials/g, '/testimonials'],
  [/\/#\/privacy/g, '/privacy.html'],
  [/\/#\/terms/g, '/terms.html'],
  [/\/#\/products/g, '/products'],
];

/* ---------- 5. Per-file transform ---------------------------------------- */

function restyle(file, html) {
  const name = path.basename(file);
  const isIndex = name === 'index.html';
  const isCategory = /^category-/.test(name);
  const isArticle = !isIndex && !isCategory;

  const head = html.slice(0, html.indexOf('</head>'));
  let newHead = head;
  let body = html.slice(html.indexOf('</head>'));

  /* --- head ------------------------------------------------------------- */

  newHead = newHead
    .replace(/\s*<script>document\.documentElement\.classList\.add\("js-enabled"\);<\/script>/g, '')
    .replace(/\s*<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g, '')
    .replace(/\s*<link[^>]*rel="preconnect"[^>]*>/g, '')
    .replace(/\s*<link[^>]*href="\.?\/?blog\.css"[^>]*>/g, '')
    .replace(/content="#0a0a0a"/g, 'content="#FBFAF8"');

  newHead = newHead.replace(/\s*$/, '\n\n' + HEAD_LINKS);

  /* --- strip the bespoke chrome ----------------------------------------- */

  body = body
    // only one <main> per document, and it is the one this script injects
    .replace(/<main\b/g, '<div').replace(/<\/main>/g, '</div>')
    .replace(/\s*<div (?:class="zl-scroll-progress" )?id="zl-scroll-progress"><\/div>/g, '')
    .replace(/\s*<div class="zl-blog-menu-backdrop"[^>]*><\/div>/g, '')
    .replace(/\s*<div class="zl-blog-hero-overlay"><\/div>/g, '')
    // the trust bar repeated the date and reading time already in the meta row,
    // and led with a "clinically reviewed" claim the brand cannot substantiate
    .replace(/\s*<div class="zl-blog-trust-bar">[\s\S]*?<\/div>/g, '')
    .replace(/\s*<button class="zl-back-to-top"[\s\S]*?<\/button>/g, '')
    .replace(/\s*<div class="zl-blog-sticky-quiz"[\s\S]*?<\/div>/g, '')
    // zl.js swaps the form for its own confirmation, so the always-on success
    // block and the leftover Formspree subject field are both dead weight
    .replace(/\s*<div class="zl-blog-newsletter-success">[\s\S]*?<\/div>/g, '')
    .replace(/\s*<input type="hidden" name="_subject"[^>]*>/g, '')
    // every remaining body <script> drove elements that no longer exist
    .replace(/\s*<script>[\s\S]*?<\/script>/g, '');

  body = body.replace(
    /<header class="zl-blog-header">[\s\S]*?<\/header>/,
    HEADER + '\n\n<main id="main">'
  );
  body = body.replace(
    /<footer class="zl-blog-footer">[\s\S]*?<\/footer>/,
    '</main>\n\n' + FOOTER
  );
  body = body.replace(/<\/body>/, (isIndex ? INDEX_SCRIPT + '\n\n' : '') + TAIL + '\n</body>');

  /* --- routes, paths, assets -------------------------------------------- */

  for (const [re, to] of ROUTE_FIXES) body = body.replace(re, to);
  for (const [re, to] of CLAIM_FIXES) body = body.replace(re, to);

  body = body
    .replace(/(src|href)="\.\.\/assets\//g, '$1="/assets/')
    .replace(/href="\.\/([a-z0-9-]+\.html)"/g, 'href="/blog/$1"')
    .replace(/href="(?!https?:|\/|#|mailto:|tel:)([a-z0-9-]+\.html)"/g, 'href="/blog/$1"')
    // the fallback pointed at the same file it was supposed to rescue
    .replace(/\s*onerror="this\.src='[^']*'"/g, '');

  // <img src="images/unsplash/…" … alt="…"> — alt disambiguates reused frames
  body = body.replace(
    /<img([^>]*?)src="images\/unsplash\/([^"]+)"([^>]*?)>/g,
    (all, pre, src, post) => {
      const altMatch = (pre + post).match(/alt="([^"]*)"/);
      const asset = assetFor(src, altMatch && altMatch[1]);
      return asset ? `<img${pre}src="/assets/${asset}.webp"${post}>` : all;
    }
  );
  // JSON-LD image fields and social meta both want an absolute URL
  newHead = newHead.replace(/images\/unsplash\/([^"']+)/g, (all, src) => {
    const asset = assetFor(src, null);
    return asset ? `https://zerolines.life/assets/${asset}.webp` : all;
  });
  // anything left over (there should be none) still resolves to a real asset
  const stray = /(?:\.\.\/)?images\/unsplash\/([^"']+)/g;
  body = body.replace(stray, (all, src) => {
    const asset = assetFor(src, null);
    return asset ? `/assets/${asset}.webp` : all;
  });

  /* --- ISO dates read as database rows, not as a date --------------------- */

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  body = body.replace(
    /<time class="zl-blog-card-date">(\d{4})-(\d{2})-(\d{2})<\/time>/g,
    (all, y, m, d) => `<time class="zl-blog-card-date" datetime="${y}-${m}-${d}">` +
                      `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}</time>`
  );

  /* --- inline styles the design system already owns --------------------- */

  body = body
    .replace(/<section style="margin-top:3rem;[^"]*">/g, '<section class="zl-blog-explore" data-reveal>')
    .replace(/<h3 style="font-size:1rem; font-weight:600; margin-bottom:1rem;">/g, '<h3>')
    .replace(/<p style="font-size:0\.9375rem; color:#4a4a4a; line-height:1\.6;">/g, '<p>')
    .replace(/<p style="color:#767676;font-size:0\.875rem;margin-top:0\.5rem;">/g, '<p class="zl-blog-updated">')
    .replace(/<label style="display:block;font-size:\.75rem;color:#888;margin-bottom:\.25rem">/g,
             '<label class="zl-blog-newsletter-label">');

  /* --- motion ------------------------------------------------------------ *
     Deliberately varied: the hero title rises, the hero image wipes and drifts,
     rules draw, grids stagger, quotes come from further away, asides just fade.
     Nothing is hidden without zl.js, which also carries a 2.5s failsafe. */

  body = body
    // article hero
    .replace(/<p class="zl-blog-eyebrow">/g, '<p class="zl-blog-eyebrow" data-reveal="fade">')
    .replace(/<span class="zl-blog-hero-category">/g, '<span class="zl-blog-hero-category" data-reveal="fade">')
    .replace(/<h1 class="zl-blog-hero-title">/g,
             '<h1 class="zl-blog-hero-title" data-reveal style="--reveal-delay:90ms;--reveal-y:34px">')
    .replace(/<p class="zl-blog-hero-subtitle">/g,
             '<p class="zl-blog-hero-subtitle" data-reveal style="--reveal-delay:200ms">')
    .replace(/<div class="zl-blog-hero-meta">/g,
             '<div class="zl-blog-hero-meta" data-reveal="fade" style="--reveal-delay:280ms">')
    .replace(/<div class="zl-blog-trust-bar">/g,
             '<div class="zl-blog-trust-bar" data-reveal="fade" style="--reveal-delay:360ms">')
    .replace(/<div class="zl-blog-breadcrumbs">/g, '<div class="zl-blog-breadcrumbs" data-reveal="fade">')
    // article body
    .replace(/<h2 id="/g, '<h2 data-reveal id="')
    .replace(/<nav class="zl-blog-toc">/g, '<nav class="zl-blog-toc" data-reveal="fade">')
    .replace(/<blockquote>/g, '<blockquote data-reveal="far">')
    .replace(/<div class="zl-blog-inline-related">/g, '<div class="zl-blog-inline-related" data-reveal="fade">')
    .replace(/<div class="zl-blog-product-box">/g, '<div class="zl-blog-product-box" data-reveal>')
    .replace(/<div class="zl-blog-sources">/g, '<div class="zl-blog-sources" data-reveal="fade">')
    .replace(/<div class="zl-blog-share">/g, '<div class="zl-blog-share" data-stagger>')
    .replace(/<div class="zl-blog-cta">/g, '<div class="zl-blog-cta" data-reveal="far">')
    .replace(/<div class="zl-blog-author">/g, '<div class="zl-blog-author" data-reveal="fade">')
    .replace(/<div class="zl-blog-related-grid">/g, '<div class="zl-blog-related-grid" data-stagger>')
    .replace(/<nav class="zl-blog-article-nav">/g, '<nav class="zl-blog-article-nav" data-stagger>')
    // shared blocks
    .replace(/<(div|section) class="zl-blog-newsletter">/g, '<$1 class="zl-blog-newsletter" data-reveal>')
    .replace(/<(div|section) class="zl-blog-ai-analyst">/g, '<$1 class="zl-blog-ai-analyst" data-reveal="far">')
    .replace(/<div class="zl-blog-section-header">/g, '<div class="zl-blog-section-header" data-reveal>')
    .replace(/<div class="zl-blog-categories">/g, '<div class="zl-blog-categories" data-stagger>')
    .replace(/<div class="zl-blog-search-bar">/g, '<div class="zl-blog-search-bar" data-reveal="fade">')
    .replace(/<div class="zl-blog-landing-grid zl-blog-landing-grid--compact">/g,
             '<div class="zl-blog-landing-grid zl-blog-landing-grid--compact" data-stagger>');

  // card thumbnails need a clipping frame or the hover zoom bleeds over the
  // title beneath it; the category pages' own wrapper simply nests around this
  body = body
    .replace(/<img([^>]*?)class="zl-blog-card-image"([^>]*?)>/g,
      '<span class="zl-blog-card-media"><img$1class="zl-blog-card-image"$2></span>')
    .replace(/<img([^>]*?)class="zl-blog-landing-card-image"([^>]*?)>/g,
      '<span class="zl-blog-landing-card-media"><img$1class="zl-blog-landing-card-image"$2></span>');

  // hero image: framed, clip-path wipe, and a slow drift behind it
  body = body.replace(/<img([^>]*?)class="zl-blog-hero-image"([^>]*?)>/g,
    (all, a, b) => `<div class="zl-blog-hero-figure" data-reveal="wipe" style="--reveal-delay:180ms">` +
                   `<img${a}class="zl-blog-hero-image"${b} data-parallax="0.06"></div>`);

  // a turquoise hairline that draws itself between masthead and image
  body = body.replace(/(<div class="zl-blog-hero-figure")/,
    '<hr class="zl-blog-hero-rule zl-draw">\n      $1');

  /* --- landing + category cards reveal one at a time --------------------- */

  if (isIndex) {
    let i = 0;
    body = body.replace(/<a href="\/blog\/([a-z0-9-]+\.html)" class="zl-blog-landing-card"/g, (all) => {
      const delay = [0, 90, 180][i++ % 3];
      return all.replace('class="zl-blog-landing-card"',
        `class="zl-blog-landing-card" data-reveal style="--reveal-delay:${delay}ms"`);
    });
    // landing masthead: two masked lines rather than one blunt fade
    body = body
      .replace(/<p class="zl-blog-landing-eyebrow">/, '<p class="zl-blog-landing-eyebrow" data-reveal="fade">')
      .replace(/<h1 class="zl-blog-landing-title">Skin Science\.<br>Alpine Wisdom\.<\/h1>/,
        '<h1 class="zl-blog-landing-title">' +
        '<span class="zl-rise" style="--reveal-delay:80ms"><span>Skin science.</span></span>' +
        '<span class="zl-rise" style="--reveal-delay:200ms"><span>Alpine <em class="zl-em--brand">wisdom</em>.</span></span>' +
        '</h1>\n    <hr class="zl-blog-landing-rule zl-draw" style="--reveal-delay:340ms">')
      .replace(/<p class="zl-blog-landing-subtitle">/, '<p class="zl-blog-landing-subtitle" data-reveal style="--reveal-delay:420ms">')
      // empty-state for the search filter
      .replace(/(<section class="zl-blog-explore")/,
        '<p class="zl-blog-no-results" id="blog-empty" hidden>No entries match that search. Try another term, or browse all.</p>\n    $1')
      // the landing form only pretended to subscribe; wire it to the real endpoint
      .replace(/<form class="zl-blog-newsletter-form" onsubmit="[^"]*">[\s\S]*?<\/form>/,
        `<form class="zl-blog-newsletter-form" method="POST" name="newsletter" action="/thank-you/" data-netlify="true" netlify-honeypot="bot-field">
          <input type="hidden" name="form-name" value="newsletter">
          <p class="zl-hp" aria-hidden="true"><label>Do not fill this in: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
          <label class="zl-sr" for="nl-email">Email address</label>
          <input type="email" id="nl-email" name="email" placeholder="your@email.com" required autocomplete="email">
          <button type="submit">Subscribe</button>
        </form>`);
  }

  if (isCategory) {
    let i = 0;
    body = body.replace(/<article class="zl-blog-card" data-category="([^"]*)">/g, (all, cat) => {
      const delay = [0, 90, 180][i++ % 3];
      return `<article class="zl-blog-card" data-category="${cat}" data-reveal style="--reveal-delay:${delay}ms">`;
    });
  }

  if (isArticle) {
    // the closing cross-sell reads better as a quiet aside than a bare section
    body = body.replace(/<section class="zl-blog-explore" data-reveal>/,
      '<section class="zl-blog-explore" data-reveal="fade">');
  }

  // zl.js reports submit failures into .zl-form__status; every form needs one
  body = body.replace(/(<button type="submit">Subscribe<\/button>)/g,
    '$1\n          <span class="zl-form__status" role="status" aria-live="polite"></span>');

  return newHead + body;
}

/* ---------- 6. Run -------------------------------------------------------- */

const files = fs.readdirSync(BLOG).filter((f) => f.endsWith('.html')).sort();
let changed = 0;

for (const f of files) {
  const p = path.join(BLOG, f);
  const before = fs.readFileSync(p, 'utf8');
  const after = restyle(p, before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    changed++;
  }
  const problems = [];
  if (!/<main id="main">/.test(after)) problems.push('no <main id="main">');
  if (!/class="zl-header"/.test(after)) problems.push('no .zl-header');
  if (!/class="zl-footer/.test(after)) problems.push('no .zl-footer');
  if (/zl-blog-header|zl-blog-footer|zl-back-to-top|zl-blog-sticky-quiz/.test(after)) problems.push('legacy chrome left');
  if (/images\/unsplash/.test(after)) problems.push('unsplash left');
  if (/\/#\//.test(after)) problems.push('hash route left');
  if (/\.\.\/assets/.test(after)) problems.push('relative asset left');
  console.log(`${problems.length ? '✗' : '·'} ${f}${problems.length ? '  ' + problems.join(', ') : ''}`);
}

console.log(`\n${changed}/${files.length} file(s) rewritten`);
