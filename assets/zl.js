/* ============================================================================
   ZERO LINES — behaviour layer
   Replaces the 504KB React + GSAP bundle.

   Non-negotiable rule, learned from the previous build:
   NOTHING here may leave content permanently invisible. The CSS keeps every
   element visible by default; the `zl-js` class below opts into animation.
   Every reveal additionally has a hard failsafe timer. If IntersectionObserver
   is missing, if an error is thrown, if an element never intersects — the
   content still appears.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Opt into animation synchronously, before first paint, so there is no flash
  // of visible-then-hidden content. Skipped entirely for reduced-motion users.
  if (!reduced && 'IntersectionObserver' in window) root.classList.add('zl-js');

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- 1. Scroll reveal ------------------------------------------- */

  function initReveal() {
    if (!root.classList.contains('zl-js')) return;

    var targets = [].slice.call(document.querySelectorAll('[data-reveal], .zl-rise'));
    if (!targets.length) return;

    var show = function (el) { el.classList.add('is-in'); };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

    targets.forEach(function (el) {
      // Anything already in view on load reveals immediately — no waiting for a scroll.
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) show(el);
      else io.observe(el);
    });

    // Hard failsafe: whatever happens, everything is visible within 2.5s.
    setTimeout(function () { targets.forEach(show); }, 2500);
  }

  /* ---------- 2. Header state -------------------------------------------- */

  function initHeader() {
    var header = document.querySelector('.zl-header');
    if (!header) return;

    // A page with a full-bleed hero starts transparent over it; everything else
    // starts solid so the nav is always legible.
    var hero = document.querySelector('.zl-hero');
    var solidFrom = hero ? Math.max(hero.offsetHeight - 120, 80) : 0;

    var ticking = false;
    function update() {
      header.setAttribute('data-mode', window.scrollY >= solidFrom ? 'solid' : 'over');
      ticking = false;
    }
    update();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', function () {
      solidFrom = hero ? Math.max(hero.offsetHeight - 120, 80) : 0;
      update();
    }, { passive: true });
  }

  /* ---------- 3. Mobile menu --------------------------------------------- */

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
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }

    burger.addEventListener('click', function () {
      setOpen(menu.getAttribute('data-open') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.getAttribute('data-open') === 'true') setOpen(false);
    });
    setOpen(false);
  }

  /* ---------- 4. Legacy hash-route rescue --------------------------------- */
  /* The old SPA used #/science, #/products/day-cream etc. Those URLs are still
     in the wild — in inbound links, bookmarks and anything Google cached before
     the clean-URL migration. Hash fragments never reach the server, so Netlify
     cannot redirect them; they have to be caught here. */

  function initHashRescue() {
    var hash = window.location.hash || '';
    if (hash.indexOf('#/') !== 0) return;
    var target = hash.slice(1);                       // "#/science" -> "/science"
    if (target === '/' || target === '') target = '/';
    if (target !== window.location.pathname) {
      window.location.replace(target);
    }
  }

  /* ---------- 5. Cookie banner ------------------------------------------- */

  function initCookies() {
    var banner = document.getElementById('zl-cookie');
    if (!banner) return;
    var KEY = 'zl_cookie_choice';

    try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }

    // Hold it back until the visitor has actually started reading. Shown on
    // first paint it competes with the hero headline, and on narrow viewports
    // it lands directly on top of the hero's call-to-action buttons.
    var shown = false;
    function reveal() {
      if (shown) return;
      shown = true;
      banner.setAttribute('data-open', 'true');
      window.removeEventListener('scroll', onScroll);
    }
    function onScroll() { if (window.scrollY > 240) reveal(); }

    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(reveal, 12000);        // backstop for visitors who never scroll

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      try { localStorage.setItem(KEY, btn.getAttribute('data-cookie')); } catch (err) {}
      banner.setAttribute('data-open', 'false');
    });
  }

  /* ---------- 6. Netlify form submit ------------------------------------- */

  function initForms() {
    [].slice.call(document.querySelectorAll('form[data-netlify]')).forEach(function (form) {
      form.addEventListener('submit', function (e) {
        // Progressive enhancement only. Without JS the form posts normally to
        // /thank-you/ and still works.
        e.preventDefault();

        var status = form.querySelector('.zl-form__status');
        var btn = form.querySelector('button[type="submit"]');
        var original = btn ? btn.textContent : '';

        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        if (status) { status.removeAttribute('data-state'); status.textContent = ''; }

        fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString()
        })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var wrap = form.parentNode;
            form.remove();
            var ok = document.createElement('p');
            ok.className = 'zl-form__status';
            ok.setAttribute('data-state', 'ok');
            ok.setAttribute('role', 'status');
            ok.textContent = 'Thank you — you are on the list. We will be in touch.';
            wrap.appendChild(ok);
          })
          .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = original; }
            if (status) {
              status.setAttribute('data-state', 'err');
              status.textContent = 'Something went wrong. Please email info@zerolines.life and we will add you.';
            }
          });
      });
    });
  }

  /* ---------- 7. Current-page nav state ---------------------------------- */

  function initCurrentNav() {
    var here = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
    [].slice.call(document.querySelectorAll('.zl-header__link, .zl-menu__link')).forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      if (href === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---------- boot -------------------------------------------------------- */

  initHashRescue();   // before paint where possible — it may navigate away
  ready(function () {
    try { initReveal(); } catch (e) { document.querySelectorAll('[data-reveal],.zl-rise').forEach(function (el) { el.classList.add('is-in'); }); }
    try { initHeader(); } catch (e) {}
    try { initMenu(); } catch (e) {}
    try { initCookies(); } catch (e) {}
    try { initForms(); } catch (e) {}
    try { initCurrentNav(); } catch (e) {}
  });
})();
