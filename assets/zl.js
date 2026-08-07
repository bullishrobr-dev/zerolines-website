/* ============================================================================
   ZERO LINES — behaviour layer v2

   v1's motion was one fade-and-rise applied to everything, which reads flat.
   v2 provides a vocabulary — wipes, masked line rise, stagger, parallax,
   counters, scroll-linked progress, and weighted inertial scrolling — so
   different content moves differently and the page has rhythm.

   The safety model is unchanged and absolute: CSS keeps everything visible by
   default, `zl-js` opts into animation, and every reveal has a hard failsafe
   timer. If any of this throws, the page still reads.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Two tiers, not one. Reduce Motion used to zero out EVERY effect — a visitor
  // with it enabled (it ships on with Low Power Mode on some phones) saw a
  // completely static page and reasonably concluded the site had no animation
  // at all. Vestibular safety is about MOVEMENT — transforms, parallax, scrub —
  // not about opacity. So under reduced motion the reveals still run as gentle
  // fades (the CSS strips their translate via html.zl-rm), and only the moving
  // effects are withheld.
  var canReveal = 'IntersectionObserver' in window;
  var canMove = canReveal && !reduced;
  var canAnimate = canMove;   // legacy name used by the moving effects below

  if (canReveal) root.classList.add('zl-js');
  if (reduced) root.classList.add('zl-rm');

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function $(sel, ctx) { return [].slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- 1. Legacy hash-route rescue -------------------------------- *
     The old SPA used #/science, #/products/day-cream. Those URLs are still in
     bookmarks, inbound links and Google's cache, and hash fragments never reach
     the server so Netlify cannot redirect them. Runs before anything paints. */

  (function hashRescue() {
    var hash = window.location.hash || '';
    if (hash.indexOf('#/') !== 0) return;
    var target = hash.slice(1);
    if (target === '/quiz' || target === '/analyser') target = '/analyser/';
    var here = window.location.pathname.replace(/\/$/, '');
    if (target.replace(/\/$/, '') !== here) {
      window.location.replace(target);
    } else {
      // same page, stale hash — strip it so it cannot confuse anything
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  })();

  /* ---------- 2. Reveal -------------------------------------------------- */

  function initReveal() {
    // canReveal, not canMove: under Reduce Motion these still run as pure
    // opacity fades — html.zl-rm strips the translate in CSS.
    if (!canReveal) return;
    var targets = $('[data-reveal], [data-stagger], .zl-rise, .zl-draw');
    if (!targets.length) return;

    function show(el) { el.classList.add('is-in'); }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

    targets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      // Only what is already on screen at load reveals immediately. Everything
      // else waits for the visitor to actually reach it.
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) show(el);
      else io.observe(el);
    });

    // SAFETY NET — deliberately NOT a blanket timer.
    //
    // This used to be `setTimeout(() => targets.forEach(show), 2500)`, which
    // revealed the entire document 2.5s after load. Measured on the homepage:
    // by t=3000ms all 62 below-the-fold elements already carried .is-in. Nothing
    // could animate in when the visitor reached it, because it had been revealed
    // while they were still looking at the hero. The page read, in the owner's
    // words, like "one big canvas" — every element simply stuck in place.
    //
    // The failure this net actually needs to catch is "IntersectionObserver
    // exists but never fires", and the only harm from that is content stranded
    // invisible IN FRONT OF the visitor. So sweep what is on screen, and leave
    // everything below to arrive on its own.
    // Reveals everything from the fold line UPWARD — anything on screen, and
    // anything already scrolled past. Only what is still below stays held back,
    // because that is the only content that can still meaningfully arrive.
    //
    // The "already passed" half matters: a fast scroll or an anchor jump can
    // carry an element by before the observer fires, and there is nothing to
    // animate for content the visitor has gone past — leaving it invisible is
    // the one genuinely broken outcome. Measured: fast-scrolling the syringe
    // page left 23 elements stranded before this.
    function sweepVisible() {
      var fold = window.innerHeight * 0.95;
      for (var i = 0; i < targets.length; i++) {
        var el = targets[i];
        if (el.classList.contains('is-in')) continue;
        if (el.getBoundingClientRect().top < fold) show(el);
      }
    }

    var sweeping = false;
    window.addEventListener('scroll', function () {
      if (sweeping) return;
      sweeping = true;
      requestAnimationFrame(function () { sweepVisible(); sweeping = false; });
    }, { passive: true });
    window.addEventListener('resize', sweepVisible, { passive: true });
    setTimeout(sweepVisible, 1200);   // covers a load that settles late
  }

  /* ---------- 3. Parallax ------------------------------------------------ *
     Subtle only. data-parallax="0.12" moves the element at 12% of scroll.
     Values above ~0.25 start to feel like a gimmick rather than depth. */

  function initParallax() {
    if (!canAnimate) return;
    // Parallax writes an inline transform. Scrub drives the same property from
    // CSS, so an element inside a .zl-scrub container would have its scale
    // silently clobbered — the image tracked scroll but never actually zoomed.
    // Scrub wins; it is the richer effect.
    var items = $('[data-parallax]')
      .filter(function (el) { return !el.closest('.zl-scrub'); })
      .map(function (el) {
        return { el: el, factor: parseFloat(el.getAttribute('data-parallax')) || 0.12 };
      });
    if (!items.length) return;

    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      items.forEach(function (it) {
        var r = it.el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        // -1 at top of viewport, +1 at bottom
        var progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        it.el.style.transform = 'translate3d(0,' + (progress * it.factor * 100).toFixed(2) + 'px,0)';
      });
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ---------- 3b. Scrub and pin ------------------------------------------ *
     The two effects that make a page feel weighted rather than merely scrolled,
     and the ones mobile was missing entirely. Both are driven from one rAF loop
     writing a custom property, so the compositor animates and nothing reflows. */

  function initScrub() {
    if (!canAnimate) return;

    var scrubs = $('.zl-scrub');
    var pins = $('.zl-pin');
    if (!scrubs.length && !pins.length) return;

    var ticking = false;

    function frame() {
      var vh = window.innerHeight;

      for (var i = 0; i < scrubs.length; i++) {
        var el = scrubs[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) continue;
        // 0 as the element enters from below, 1 once it has settled in view
        var p = 1 - Math.max(0, Math.min(1, (r.top - vh * 0.15) / (vh * 0.85)));
        el.style.setProperty('--scrub', p.toFixed(4));
      }

      for (var j = 0; j < pins.length; j++) {
        var pin = pins[j];
        var pr = pin.getBoundingClientRect();
        // hand over once the section is nearly done travelling
        pin.setAttribute('data-leaving', pr.bottom < vh * 0.55 ? 'true' : 'false');
      }

      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    frame();
  }

  /* ---------- 3c. Horizontal rails --------------------------------------- *
     Bring the current step into view on load so a visitor on step 05 does not
     have to hunt for where they are in the rail. */

  function initRails() {
    $('.zl-rail').forEach(function (rail) {
      var current = rail.querySelector('[aria-current="step"]');
      if (!current) return;
      var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 16;
      var r = current.getBoundingClientRect();
      var rr = rail.getBoundingClientRect();
      // Already sitting inside the gutter on both sides: leave it alone.
      if (r.left >= rr.left + pad && r.right <= rr.right - pad) return;

      /* Adjust by the rendered gap rather than deriving a position from
         offsetLeft. The rail carries a negative inline margin on phones so it
         can bleed to the viewport, and offsetLeft is measured from the
         offsetParent's padding edge — the arithmetic is answerable but there is
         no reason to do it when the browser will tell you where the card
         actually is.

         The flush-to-the-edge bug this used to show was not here: it was the
         missing scroll-padding-inline in zl.css, without which scroll snapping
         pulled the card back to the scrollport edge whatever this line set. */
      rail.scrollLeft = Math.max(0, rail.scrollLeft + (r.left - rr.left) - pad);
    });
  }

  /* ---------- 4. Counters ------------------------------------------------ */

  function initCounters() {
    var els = $('[data-count]');
    if (!els.length) return;
    if (!canAnimate) {
      els.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-count-suffix') || '';
        var dur = 1600, t0 = null;
        function frame(t) {
          if (t0 === null) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 4);          // quart-out, matches --ease
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.4 });

    els.forEach(function (el) { el.textContent = '0' + (el.getAttribute('data-count-suffix') || ''); io.observe(el); });
    setTimeout(function () {
      els.forEach(function (el) {
        if (el.textContent === '0' + (el.getAttribute('data-count-suffix') || '')) {
          el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-count-suffix') || '');
        }
      });
    }, 3000);
  }

  /* ---------- 5. Scroll progress ----------------------------------------- */

  function initProgress() {
    var bar = document.querySelector('.zl-progress');
    if (!bar) return;
    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ---------- 6. Header -------------------------------------------------- */

  function initHeader() {
    var header = document.querySelector('.zl-header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.setAttribute('data-scrolled', window.scrollY > 24 ? 'true' : 'false');
      ticking = false;
    }
    update();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  /* ---------- 7. Menu ---------------------------------------------------- */

  function initMenu() {
    var burger = document.querySelector('.zl-burger');
    var menu = document.getElementById('zl-menu');
    if (!burger || !menu) return;
    var lastFocus = null;

    var heldScroll = 0;

    function setOpen(open) {
      menu.setAttribute('data-open', open ? 'true' : 'false');
      root.setAttribute('data-menu', open ? 'open' : 'closed');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');

      /* overflow:hidden alone does not hold position on iOS — the page silently
         scrolls under the overlay, and closing the menu leaves the reader
         somewhere they never navigated to. Pinning the body and restoring the
         offset keeps them exactly where they opened it. */
      if (open) {
        heldScroll = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = -heldScroll + 'px';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
      } else if (document.body.style.position === 'fixed') {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        // html has scroll-behavior:smooth, so a plain scrollTo animates and
        // lands late — measured 137px adrift. This one has to be instant.
        try { window.scrollTo({ top: heldScroll, behavior: 'instant' }); }
        catch (e) { window.scrollTo(0, heldScroll); }
      }

      if (open) {
        lastFocus = document.activeElement;
        var first = menu.querySelector('a, button');
        if (first) first.focus();
      } else if (lastFocus && lastFocus.focus) {
        lastFocus.focus();
      }
    }

    burger.addEventListener('click', function () { setOpen(menu.getAttribute('data-open') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      var open = menu.getAttribute('data-open') === 'true';
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;

      /* Keep focus inside the overlay. Without this, Tab from the last link
         walks into the page behind it and the visitor is operating controls
         they cannot see. The burger is included because it is the close
         control and has to stay reachable. */
      var items = [burger].concat(
        [].slice.call(menu.querySelectorAll('a[href], button:not([disabled])'))
      ).filter(function (el) { return el.offsetParent !== null || el === burger; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    setOpen(false);
  }

  /* ---------- 8. Cookie notice ------------------------------------------- */

  /* ---------- Consent, and the analytics that depend on it ----------------
     The banner used to record a choice and then gate nothing at all — there was
     no analytics on the site, so "Essential only" and "Accept all" did exactly
     the same thing. That is fine while nothing is loading, and becomes a real
     problem the moment something does: a notice that implies a choice it does
     not honour is worse than no notice, and this is a Gibraltar and Barcelona
     business under UK and EU rules.

     So consent is now a gate with something behind it. Nothing here loads until
     an ID is filled in below AND the visitor has accepted. Leave an ID empty and
     that tool is simply never loaded.

     Worth knowing before you fill these in: GA4 and the Meta pixel both set
     cookies and both send visitor data to a third party, so they can only run
     for people who click Accept — which in practice is well under half. A
     cookieless tool (Cloudflare Web Analytics is free, and you already have the
     account) needs no consent at all, so it measures everybody. If you only want
     to know what pages people read and where they drop out of the analyser, it
     will tell you more than GA4 will. */
  var ANALYTICS = {
    ga4: '',            // 'G-XXXXXXXXXX'  — needs consent
    metaPixel: '',      // '123456789012'  — needs consent
    cloudflareToken: '66cbb3e739024eb194d16b8e2f364089' // Cloudflare Web Analytics — cookieless, so no consent needed
  };

  var CONSENT_KEY = 'zl_cookie_choice';

  function consentGiven() {
    try { return localStorage.getItem(CONSENT_KEY) === 'all'; } catch (e) { return false; }
  }

  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
    return s;
  }

  var analyticsLoaded = false;

  /* Cookieless measurement. No personal data, no cookies, so it is lawful
     without consent and runs for every visitor. */
  function initCookielessAnalytics() {
    if (!ANALYTICS.cloudflareToken) return;
    loadScript('https://static.cloudflareinsights.com/beacon.min.js',
      { 'data-cf-beacon': JSON.stringify({ token: ANALYTICS.cloudflareToken }) });
  }

  /* Everything that needs a yes. Called on load if consent was already given,
     and again the moment someone accepts, so they are measured from that page
     rather than the next one. */
  function initConsentedAnalytics() {
    if (analyticsLoaded || !consentGiven()) return;
    analyticsLoaded = true;

    if (ANALYTICS.ga4) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      // IP anonymisation is on by default in GA4; ad personalisation is not.
      window.gtag('config', ANALYTICS.ga4, { anonymize_ip: true, allow_ad_personalization_signals: false });
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ANALYTICS.ga4));
    }

    if (ANALYTICS.metaPixel) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', ANALYTICS.metaPixel);
      window.fbq('track', 'PageView');
    }
  }

  function initAnalytics() {
    initCookielessAnalytics();
    initConsentedAnalytics();
  }

  /* The WhatsApp button is fixed to the bottom-right, so every full-width
     primary button on the site passes underneath it at some scroll position.
     Measured at 390px on /blog/category-science.html: it covered the right-hand
     end of "Begin the free analysis". A permanent convenience must not sit on
     top of the thing the page is asking the reader to do, and nudging one
     button would only move the collision to the next one — so the bubble yields
     to whichever primary action is under it, everywhere, and comes back after. */
  function initWhatsAppYield() {
    var wa = document.querySelector('.zl-wa');
    if (!wa) return;
    var SEL = '.zl-btn--brand, .zl-blog-ai-analyst-btn, .zl-cta__btn, button[type="submit"]';
    var PAD = 12;
    var queued = false;

    function check() {
      queued = false;
      var b = wa.getBoundingClientRect();
      var els = document.querySelectorAll(SEL);
      var hit = false;
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) continue;
        if (r.right > b.left - PAD && r.left < b.right + PAD &&
            r.bottom > b.top - PAD && r.top < b.bottom + PAD) { hit = true; break; }
      }
      wa.classList.toggle('zl-wa--yield', hit);
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(check); } }

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    queue();
  }

  function initCookies() {
    var banner = document.getElementById('zl-cookie');
    var KEY = CONSENT_KEY;

    /* Withdrawing consent is handled on cookies.html, which owns the control
       and its wording. Nothing to duplicate here. */
    if (!banner) return;
    try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }

    var shown = false;

    // The notice is fixed to the bottom edge, so it always sits over something.
    // It used to be a 360x148 card, which measured as covering main content at
    // 23 of 32 sampled scroll positions on mobile — including the entire body of
    // the "Over time" panel. It is now a slim single-line bar; reserving matching
    // space at the foot of the document keeps the very last elements reachable.
    function reserveSpace() {
      if (!shown) return;
      var h = banner.getBoundingClientRect().height;
      document.body.style.paddingBottom = (h + 16) + 'px';
    }

    function open() {
      if (shown) return;
      shown = true;
      banner.setAttribute('data-open', 'true');
      document.body.setAttribute('data-cookie-open', 'true');
      window.removeEventListener('scroll', onScroll);
      requestAnimationFrame(reserveSpace);
    }

    function close() {
      shown = false;
      banner.setAttribute('data-open', 'false');
      document.body.removeAttribute('data-cookie-open');
      document.body.style.paddingBottom = '';
    }

    // Held back until the visitor scrolls — shown on first paint it competes with
    // the hero, and on narrow viewports it lands on the hero's own buttons.
    /* Never while someone is mid-reading. The analyser's quiz and photo steps
       put their controls near the bottom of the viewport, and a fixed bar there
       covered 71% of Continue on a 375px screen — the only conversion tool the
       brand has, blocked on the first thing a stranger does. The notice waits
       for the intro, the result or the sent panel, which costs nothing: no
       non-consented tag can load in the meantime, because the gate holds them
       regardless of whether the bar has been answered yet. */
    function midFlow() {
      var q = document.getElementById('zl-a-quiz');
      var ph = document.getElementById('zl-a-photo');
      return !!((q && !q.hidden) || (ph && !ph.hidden));
    }

    function onScroll() { if (window.scrollY > 280 && !midFlow()) open(); }
    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(function () { if (!midFlow()) open(); }, 14000);   // backstop for visitors who never scroll
    window.addEventListener('resize', reserveSpace, { passive: true });

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      try { localStorage.setItem(KEY, btn.getAttribute('data-cookie')); } catch (err) {}
      close();
      // Start measuring from this page rather than the next one.
      try { initConsentedAnalytics(); } catch (err) {}
    });
  }

  /* ---------- 9. Netlify forms ------------------------------------------- */

  function initForms() {
    $('form[data-netlify]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();   // progressive enhancement; without JS it posts normally
        var status = form.querySelector('.zl-form__status');
        var btn = form.querySelector('button[type="submit"]');
        var original = btn ? btn.textContent : '';

        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        if (status) { status.removeAttribute('data-state'); status.textContent = ''; }

        /* Netlify Forms accepted a post to '/' with a form-name field. That
           service is being left behind, so submissions now go to the site's
           own Worker endpoint, which writes to a database on this account. */
        fetch('/__forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString()
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          var wrap = form.parentNode;
          form.remove();
          var ok = document.createElement('p');
          ok.className = 'zl-form__status';
          ok.setAttribute('data-state', 'ok');
          ok.setAttribute('role', 'status');
          /* The contact form posts through this same handler, so a press or
             wholesale enquiry was being told it had joined a mailing list —
             directly contradicting the promise fourteen lines below it that the
             message is used only to answer them. */
          var isContact = (form.getAttribute('name') || '') === 'contact';
          ok.textContent = isContact
            ? 'Thank you — your message is with us. We reply within one working day.'
            : 'Thank you — you are on the list. We will be in touch.';
          wrap.appendChild(ok);

          /* Every waitlist form carries action="/thank-you/", and that page is
             the only place a fresh subscriber is offered the analyser. Because
             this handler preventDefaults unconditionally, no visitor with
             JavaScript had ever reached it — the highest-intent moment in the
             funnel ended in a full stop. Rather than navigate away from a page
             they may still be reading, offer the next step where they are. */
          if (!isContact && !wrap.querySelector('[data-next-step]')) {
            var next = document.createElement('p');
            next.setAttribute('data-next-step', '');
            next.style.cssText = 'margin-top:1rem;font-size:.9375rem;line-height:1.7';
            next.innerHTML = 'Your complimentary skin analysis does not wait for launch — '
              + '<a href="/analyser/">take it now</a>. It asks for no account, and the '
              + 'reading is written out and sent to you.';
            wrap.appendChild(next);
          }
        }).catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = original; }
          if (status) {
            status.setAttribute('data-state', 'err');
            status.textContent = 'Something went wrong. Please email info@zerolines.life and we will add you.';
          }
        });
      });
    });
  }

  /* ---------- 10. Current page nav state --------------------------------- */

  function initCurrentNav() {
    var here = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
    $('.zl-header__link, .zl-menu__link').forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      if (href === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---------- 11. Weighted scroll ---------------------------------------- *
     Lenis gives scrolling the inertia luxury sites use. Loaded only when it is
     present and motion is allowed; the site is fully functional without it. */

  /* Scroll hijacking is GONE. The browser owns the scroll position.
   *
   * lenis was tried at duration:1.25 and then at lerp:0.14 and was annoying at
   * both — any interpolation between the wheel and the page puts a lag between
   * intent and response, and no amount of tuning removes that, it only makes it
   * smaller. Native scroll is instant and matches every other page the visitor
   * uses. Every other effect is unaffected: the reveals, scrub, pin, stagger and
   * parallax all read window.scrollY, and they work identically on native scroll.
   *
   * Anchors go back to the browser too, via CSS scroll-behavior:smooth plus
   * scroll-padding-top, which handles the header offset without JavaScript —
   * and without the ~1,100px undershoot lenis had when handed a DOM node.
   */
  function initSmoothScroll() {
    // Deliberately a no-op. Kept as a named function so the boot sequence and
    // this explanation stay together, rather than the reason being lost in a
    // diff for whoever wonders later why there is no smooth-scroll library.
  }

  /* ---------- boot -------------------------------------------------------- */

  ready(function () {
    try { initReveal(); } catch (e) {
      $('[data-reveal],[data-stagger],.zl-rise,.zl-draw').forEach(function (el) { el.classList.add('is-in'); });
    }
    try { initHeader(); } catch (e) {}
    try { initMenu(); } catch (e) {}
    try { initParallax(); } catch (e) {}
    try { initScrub(); } catch (e) {}
    try { initRails(); } catch (e) {}
    try { initCounters(); } catch (e) {}
    try { initProgress(); } catch (e) {}
    try { initCookies(); } catch (e) {}
    try { initAnalytics(); } catch (e) {}
    try { initWhatsAppYield(); } catch (e) {}
    try { initForms(); } catch (e) {}
    try { initCurrentNav(); } catch (e) {}
    try { initSmoothScroll(); } catch (e) {}
  });
})();
