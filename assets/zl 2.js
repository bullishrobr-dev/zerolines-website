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
      var r = current.getBoundingClientRect();
      var rr = rail.getBoundingClientRect();
      if (r.left >= rr.left && r.right <= rr.right) return;   // already visible

      // Land it inside the rail's own gutter rather than flush to the edge —
      // a card jammed against the viewport edge reads as clipped, not aligned.
      var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 16;
      rail.scrollLeft = Math.max(0, current.offsetLeft - rail.offsetLeft - pad);
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

    function setOpen(open) {
      menu.setAttribute('data-open', open ? 'true' : 'false');
      root.setAttribute('data-menu', open ? 'open' : 'closed');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
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
      if (e.key === 'Escape' && menu.getAttribute('data-open') === 'true') setOpen(false);
    });
    setOpen(false);
  }

  /* ---------- 8. Cookie notice ------------------------------------------- */

  function initCookies() {
    var banner = document.getElementById('zl-cookie');
    if (!banner) return;
    var KEY = 'zl_cookie_choice';
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
    function onScroll() { if (window.scrollY > 280) open(); }
    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(open, 14000);              // backstop for visitors who never scroll
    window.addEventListener('resize', reserveSpace, { passive: true });

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      try { localStorage.setItem(KEY, btn.getAttribute('data-cookie')); } catch (err) {}
      close();
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

        fetch('/', {
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
          ok.textContent = 'Thank you — you are on the list. We will be in touch.';
          wrap.appendChild(ok);
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
    try { initForms(); } catch (e) {}
    try { initCurrentNav(); } catch (e) {}
    try { initSmoothScroll(); } catch (e) {}
  });
})();
