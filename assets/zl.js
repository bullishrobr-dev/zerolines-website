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
  var canAnimate = !reduced && 'IntersectionObserver' in window;

  if (canAnimate) root.classList.add('zl-js');

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
    if (!canAnimate) return;
    var targets = $('[data-reveal], [data-stagger], .zl-rise, .zl-draw');
    if (!targets.length) return;

    function show(el) { el.classList.add('is-in'); }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });

    targets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 1.05 && r.bottom > 0) show(el);
      else io.observe(el);
    });

    // Absolute backstop — everything visible within 2.5s no matter what.
    setTimeout(function () { targets.forEach(show); }, 2500);
  }

  /* ---------- 3. Parallax ------------------------------------------------ *
     Subtle only. data-parallax="0.12" moves the element at 12% of scroll.
     Values above ~0.25 start to feel like a gimmick rather than depth. */

  function initParallax() {
    if (!canAnimate) return;
    var items = $('[data-parallax]').map(function (el) {
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

    // The notice is fixed to the bottom, so on a narrow viewport it sits on top
    // of whatever ends the page — which on several pages is the waitlist Register
    // button and its privacy link, leaving them genuinely unclickable. Reserving
    // matching space at the foot of the document lets the visitor scroll any
    // covered control clear of it.
    function reserveSpace() {
      if (!shown) return;
      var h = banner.getBoundingClientRect().height;
      var gap = window.innerWidth <= 560 ? 16 : 24;
      document.body.style.paddingBottom = (h + gap * 2 + 52) + 'px';
    }

    function open() {
      if (shown) return;
      shown = true;
      banner.setAttribute('data-open', 'true');
      window.removeEventListener('scroll', onScroll);
      requestAnimationFrame(reserveSpace);
    }

    function close() {
      shown = false;
      banner.setAttribute('data-open', 'false');
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

  function initSmoothScroll() {
    if (!canAnimate || typeof window.Lenis !== 'function') return;
    if (window.innerWidth < 900) return;      // native momentum is better on touch
    try {
      var lenis = new window.Lenis({
        duration: 1.25,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        smoothTouch: false
      });
      // Tell the stylesheet to stand down: CSS scroll-behavior:smooth animates the
      // same scroll position lenis writes every frame, and anchors land short.
      root.classList.add('zl-lenis');

      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);

      // In-page anchors go through lenis so they inherit the same weight.
      //
      // Pass an absolute pixel position, NOT the element. Handing lenis 1.1.18 a
      // DOM node resolved short by ~1,100px on every FAQ anchor — measured
      // landing at scrollY 2810 where the target sat at 4054. The same call with
      // a number computed here lands exactly. Resolve the position at click time
      // so it accounts for whatever has since loaded or reflowed.
      $('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href');
          if (id.length < 2) return;
          var el;
          try { el = document.querySelector(id); } catch (err) { return; }
          if (!el) return;
          e.preventDefault();

          var header = document.querySelector('.zl-header');
          var pad = (header ? header.offsetHeight : 0) + 24;

          function targetY() {
            return Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad);
          }
          lenis.scrollTo(targetY());

          // Images below the fold are lazy, so content above the target can load
          // mid-flight and push it down — the homepage waitlist landed 210px
          // short that way. Re-measure once the animation has settled and close
          // any gap that opened up.
          setTimeout(function () {
            var drift = el.getBoundingClientRect().top - pad;
            if (Math.abs(drift) > 24) lenis.scrollTo(targetY(), { duration: 0.4 });
          }, 1500);

          // keep the URL shareable without letting the browser jump the page
          if (history.replaceState) history.replaceState(null, '', id);
        });
      });
      window.zlLenis = lenis;
    } catch (err) { /* native scrolling is a perfectly good fallback */ }
  }

  /* ---------- boot -------------------------------------------------------- */

  ready(function () {
    try { initReveal(); } catch (e) {
      $('[data-reveal],[data-stagger],.zl-rise,.zl-draw').forEach(function (el) { el.classList.add('is-in'); });
    }
    try { initHeader(); } catch (e) {}
    try { initMenu(); } catch (e) {}
    try { initParallax(); } catch (e) {}
    try { initCounters(); } catch (e) {}
    try { initProgress(); } catch (e) {}
    try { initCookies(); } catch (e) {}
    try { initForms(); } catch (e) {}
    try { initCurrentNav(); } catch (e) {}
    try { initSmoothScroll(); } catch (e) {}
  });
})();
