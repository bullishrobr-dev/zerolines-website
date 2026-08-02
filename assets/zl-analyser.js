/* ============================================================================
   ZERO LINES — Skin Analyser engine

   Contract with the Cloudflare Worker is unchanged:
       POST { answers, photoBase64 }  ->  a structured report

   Questions are injected as JSON by .claude/build-analyser.js so this file
   stays generic and the wording cannot drift from .claude/quiz-questions.json.

   One rule above all others: this file NEVER fabricates a report. An earlier
   build shipped a hard-coded analysis behind a "Demo Mode" banner, which meant
   visitors were handed a made-up assessment of their own face. If the service
   cannot be reached, or answers with nothing usable, the honest failure panel
   is shown and a specialist is offered instead.
   ========================================================================= */
(function () {
  'use strict';

  var API = 'https://lively-surf-87db.bullishrobr.workers.dev/';
  var TIMEOUT = 75000;                  // give the model room, then stop waiting
  var MAX_INPUT_BYTES = 16 * 1024 * 1024;
  var MAX_EDGE = 1400;                  // downscale in the browser before upload

  var QUESTIONS = [];
  try {
    QUESTIONS = JSON.parse(document.getElementById('zl-quiz-data').textContent);
  } catch (e) { return; }
  if (!QUESTIONS.length) return;

  /* The eight markers, in the order they are read and reported. */
  var MARKERS = [
    ['texture', 'Texture'],
    ['tone', 'Tone'],
    ['hydration', 'Hydration'],
    ['poreQuality', 'Pores'],
    ['pigmentation', 'Pigmentation'],
    ['wrinkles', 'Lines'],
    ['elasticity', 'Elasticity'],
    ['sunDamage', 'Sun exposure']
  ];

  /* Whatever the service names a formulation, resolve it to the one in the
     collection so the report can link the product AND its protocol step.
     Order matters: "Refill" and "Night" must be tested before "Activation"
     and "Renewal", or they resolve to the wrong page. */
  var PRODUCTS = [
    { re: /refill|cartridge/i,        slug: 'syringe-refill', step: '06',
      name: 'Precision Collagen Activation Refill', role: 'Sustain · Roughly once a year' },
    { re: /night/i,                   slug: 'night-cream',    step: '05',
      name: 'Renewal and Repair Night Cream',       role: 'Restore · Every night' },
    { re: /day cream|shield|spf|sun protection/i, slug: 'day-cream', step: '04',
      name: 'Environmental Shield Day Cream',       role: 'Shield · Every morning' },
    { re: /peel|exfolia/i,            slug: 'peeling-gel',    step: '01',
      name: 'Bio-Renewal Peeling Gel',              role: 'Renew · One evening a week' },
    { re: /syringe|activation/i,      slug: 'syringe',        step: '02',
      name: 'Precision Collagen Activation Syringe', role: 'Activate · One evening a week' },
    { re: /serum|signal/i,            slug: 'serum',          step: '03',
      name: 'BioSignal Facial Serum',               role: 'Signal · Morning and night' }
  ];

  var PANELS = ['intro', 'quiz', 'photo', 'working', 'results', 'error'];
  var HEADS = {
    photo: 'zl-a-photo-h', working: 'zl-a-working-h',
    results: 'zl-a-results-h', error: 'zl-a-error-h'
  };

  var state = { step: 0, reached: 0, answers: {}, photo: null, photoMeta: '', receipt: null };

  function $(id) { return document.getElementById(id); }
  var el = {};
  PANELS.forEach(function (k) { el[k] = $('zl-a-' + k); });

  var rail = $('zl-a-rail');
  var meter = $('zl-a-meter');
  var count = $('zl-a-count');
  var stepName = $('zl-a-stepname');
  var qHost = $('zl-a-question');
  var backBtn = $('zl-a-back');
  var nextBtn = $('zl-a-next');
  var navHint = $('zl-a-nav-hint');

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  var WORDS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

  /* ---------- panel switching --------------------------------------------- */

  function scrollToTop() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { window.scrollTo(0, 0); }
  }

  function show(name) {
    PANELS.forEach(function (k) { if (el[k]) el[k].hidden = k !== name; });
    scrollToTop();
    var head = $(HEADS[name] || '');
    if (head) {
      try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); }
    }
  }

  /* ---------- the consultation rail --------------------------------------- */

  function buildRail() {
    if (!rail) return;
    rail.innerHTML = '';
    QUESTIONS.forEach(function (q, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zl-a-rail__item';
      b.setAttribute('aria-label', 'Question ' + (i + 1) + ' of ' + QUESTIONS.length + ': ' + q.short);

      var n = document.createElement('span');
      n.className = 'zl-a-rail__n';
      n.textContent = pad(i + 1);
      var t = document.createElement('span');
      t.className = 'zl-a-rail__t';
      t.textContent = q.short;

      b.appendChild(n);
      b.appendChild(t);
      b.addEventListener('click', function () {
        if (i > state.reached) return;
        state.step = i;
        renderQuestion();
      });
      li.appendChild(b);
      rail.appendChild(li);
    });
  }

  function updateRail() {
    if (!rail) return;
    var items = rail.querySelectorAll('.zl-a-rail__item');
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute('data-state', i < state.step ? 'done' : (i === state.step ? 'current' : 'todo'));
      items[i].disabled = i > state.reached;
      if (i === state.step) items[i].setAttribute('aria-current', 'step');
      else items[i].removeAttribute('aria-current');
    }
    rail.style.setProperty('--rail-p', (((state.step + 0.5) / QUESTIONS.length) * 100).toFixed(1) + '%');
  }

  /* ---------- questions ---------------------------------------------------- */

  function answered(q) {
    var v = state.answers[q.id];
    if (q.multi) return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }
  function skippable(q) { return !!(q.multi && q.optional); }
  function selected(q, value) {
    return q.multi
      ? (state.answers[q.id] || []).indexOf(value) > -1
      : state.answers[q.id] === value;
  }

  function renderQuestion() {
    var q = QUESTIONS[state.step];
    if (!q) return;
    if (state.step > state.reached) state.reached = state.step;

    if (count) count.textContent = 'Question ' + (state.step + 1) + ' of ' + QUESTIONS.length;
    if (stepName) stepName.textContent = q.short;
    if (meter) meter.style.setProperty('--p', (((state.step + 1) / QUESTIONS.length) * 100).toFixed(1) + '%');
    updateRail();
    if (navHint) navHint.textContent = '';

    var wrap = document.createElement('div');
    wrap.className = 'zl-a-q';

    var h = document.createElement('h2');
    h.className = 'zl-a-q__title zl-display-m';
    h.id = 'zl-a-qtitle';
    h.tabIndex = -1;
    h.textContent = q.question;
    wrap.appendChild(h);

    if (q.multi) {
      var hint = document.createElement('p');
      hint.className = 'zl-a-q__hint';
      hint.textContent = q.max
        ? 'Choose up to ' + (WORDS[q.max] || q.max) + '.'
        : (skippable(q) ? 'Choose as many as apply — or continue without choosing any.' : 'Choose as many as apply.');
      wrap.appendChild(hint);
    }

    var list = document.createElement('div');
    list.className = 'zl-a-options';
    list.setAttribute('role', q.multi ? 'group' : 'radiogroup');
    list.setAttribute('aria-labelledby', 'zl-a-qtitle');
    if (q.multi) list.setAttribute('data-multi', 'true');

    var hasAnswer = answered(q);

    q.options.forEach(function (opt, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zl-a-option';
      b.setAttribute('role', q.multi ? 'checkbox' : 'radio');

      var mark = document.createElement('span');
      mark.className = 'zl-a-option__mark';
      mark.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span');
      label.className = 'zl-a-option__label';
      label.textContent = opt.label;
      b.appendChild(mark);
      b.appendChild(label);

      var sel = selected(q, opt.value);
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
      if (sel) b.setAttribute('data-selected', 'true');
      // roving tabindex: a radiogroup is one tab stop, a checkbox group is many
      b.tabIndex = q.multi ? 0 : ((sel || (!hasAnswer && idx === 0)) ? 0 : -1);

      b.addEventListener('click', function () {
        if (q.multi) {
          var arr = state.answers[q.id] ? state.answers[q.id].slice() : [];
          var at = arr.indexOf(opt.value);
          if (at > -1) arr.splice(at, 1);
          else if (q.max && arr.length >= q.max) {
            if (navHint) navHint.textContent = 'That is ' + (WORDS[q.max] || q.max) + ' already — deselect one to change it.';
            return;
          } else arr.push(opt.value);
          state.answers[q.id] = arr;
          repaintOptions(q, list);
          syncNav(q);
        } else {
          state.answers[q.id] = opt.value;
          repaintOptions(q, list);
          syncNav(q);
          // single choices carry themselves forward — a consultation keeps moving
          window.setTimeout(function () {
            if (state.answers[q.id] === opt.value && el.quiz && !el.quiz.hidden) next();
          }, 420);
        }
      });

      list.appendChild(b);
    });

    list.addEventListener('keydown', function (e) {
      var keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
      if (keys.indexOf(e.key) === -1) return;
      var opts = [].slice.call(list.querySelectorAll('.zl-a-option'));
      var at = opts.indexOf(document.activeElement);
      if (at === -1) at = 0;
      var to = at;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = (at + 1) % opts.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = (at - 1 + opts.length) % opts.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = opts.length - 1;
      e.preventDefault();
      opts.forEach(function (o, i) { o.tabIndex = i === to ? 0 : (q.multi ? 0 : -1); });
      opts[to].focus();
    });

    wrap.appendChild(list);

    qHost.innerHTML = '';
    qHost.appendChild(wrap);
    syncNav(q);

    // The option that was just activated has been removed from the document, so
    // focus would otherwise fall back to <body>. Move it to the new question.
    try { h.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }

  function repaintOptions(q, list) {
    var opts = list.querySelectorAll('.zl-a-option');
    for (var i = 0; i < opts.length; i++) {
      var sel = selected(q, q.options[i].value);
      opts[i].setAttribute('aria-checked', sel ? 'true' : 'false');
      if (sel) opts[i].setAttribute('data-selected', 'true');
      else opts[i].removeAttribute('data-selected');
    }
  }

  function syncNav(q) {
    if (!nextBtn) return;
    nextBtn.disabled = !skippable(q) && !answered(q);
    nextBtn.textContent = state.step === QUESTIONS.length - 1 ? 'Continue to the photograph' : 'Continue';
    if (backBtn) backBtn.textContent = state.step === 0 ? 'Back to the start' : 'Back';
  }

  function next() {
    var q = QUESTIONS[state.step];
    if (!q) return;
    if (!skippable(q) && !answered(q)) {
      if (navHint) navHint.textContent = q.multi ? 'Choose at least one to continue.' : 'Choose one to continue.';
      return;
    }
    if (state.step < QUESTIONS.length - 1) {
      state.step++;
      renderQuestion();
    } else {
      show('photo');
    }
  }

  function back() {
    if (state.step > 0) { state.step--; renderQuestion(); }
    else show('intro');
  }

  /* ---------- the photograph ------------------------------------------------ */

  var fileInput = $('zl-a-file');
  var dropZone = $('zl-a-drop');
  var preview = $('zl-a-preview');
  var previewImg = $('zl-a-preview-img');
  var previewMeta = $('zl-a-preview-meta');
  var analyseBtn = $('zl-a-analyse');
  var photoErr = $('zl-a-photo-error');
  var scanImg = $('zl-a-scan-img');

  function fromBitmap(file) {
    if (typeof createImageBitmap !== 'function') return Promise.reject(new Error('no bitmap'));
    // honours EXIF orientation, which phone photographs rely on
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  function fromReader(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('That file could not be read.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That does not look like an image we can read.')); };
        img.onload = function () { resolve(img); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function downscale(file) {
    return fromBitmap(file).catch(function () { return fromReader(file); }).then(function (src) {
      var sw = src.width, sh = src.height;
      if (!sw || !sh) throw new Error('That image had no readable dimensions.');
      var scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
      var w = Math.max(1, Math.round(sw * scale));
      var h = Math.max(1, Math.round(sh * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(src, 0, 0, w, h);
      if (src.close) src.close();
      return { url: canvas.toDataURL('image/jpeg', 0.86), w: w, h: h };
    });
  }

  function approxKB(dataUrl) {
    var b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Math.round((b64.length * 3 / 4) / 1024);
  }

  function acceptFile(file) {
    if (photoErr) photoErr.textContent = '';
    if (!file) return;
    if (file.type && !/^image\//.test(file.type)) {
      photoErr.textContent = 'That is not an image file. Please choose a JPG, PNG or HEIC photograph.';
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      photoErr.textContent = 'That photograph is very large. Please choose one under about 16MB.';
      return;
    }
    if (dropZone) dropZone.setAttribute('data-drag', 'true');
    downscale(file).then(function (out) {
      state.photo = out.url;
      state.photoMeta = out.w + ' × ' + out.h + ' pixels · about ' + approxKB(out.url) + ' KB after resizing in your browser';
      if (previewImg) previewImg.src = out.url;
      if (previewMeta) {
        previewMeta.textContent = 'Check the whole face is in frame, in focus and lit from the front. ' + state.photoMeta + '.';
      }
      if (preview) preview.hidden = false;
      if (dropZone) { dropZone.hidden = true; dropZone.removeAttribute('data-drag'); }
      if (analyseBtn) analyseBtn.disabled = false;
    }).catch(function (err) {
      if (dropZone) dropZone.removeAttribute('data-drag');
      if (photoErr) photoErr.textContent = err.message || 'That photograph could not be prepared.';
    });
  }

  function resetPhoto() {
    state.photo = null;
    state.photoMeta = '';
    if (fileInput) fileInput.value = '';
    if (preview) preview.hidden = true;
    if (dropZone) dropZone.hidden = false;
    if (analyseBtn) analyseBtn.disabled = true;
    if (photoErr) photoErr.textContent = '';
  }

  if (dropZone) {
    dropZone.addEventListener('click', function () { if (fileInput) fileInput.click(); });
    dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (fileInput) fileInput.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (t) {
      dropZone.addEventListener(t, function (e) { e.preventDefault(); dropZone.setAttribute('data-drag', 'true'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      dropZone.addEventListener(t, function (e) { e.preventDefault(); dropZone.removeAttribute('data-drag'); });
    });
    dropZone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) acceptFile(e.dataTransfer.files[0]);
    });
  }
  if (fileInput) fileInput.addEventListener('change', function () { acceptFile(fileInput.files[0]); });

  var retake = $('zl-a-retake');
  if (retake) retake.addEventListener('click', function () {
    resetPhoto();
    if (fileInput) fileInput.click();
  });

  /* ---------- the wait ------------------------------------------------------ */

  function startWorking() {
    var host = $('zl-a-markers');
    var status = $('zl-a-working-status');
    var nodes = [];
    if (host) {
      host.innerHTML = '';
      MARKERS.forEach(function (m, i) {
        var li = document.createElement('li');
        li.className = 'zl-a-marker';
        var n = document.createElement('span');
        n.className = 'zl-a-marker__n';
        n.textContent = pad(i + 1);
        var t = document.createElement('span');
        t.textContent = m[1];
        li.appendChild(n);
        li.appendChild(t);
        host.appendChild(li);
        nodes.push(li);
      });
    }

    var i = 0;
    if (nodes[0]) nodes[0].setAttribute('data-state', 'active');
    if (status) status.textContent = 'Reading ' + MARKERS[0][1].toLowerCase() + '.';

    var timer = window.setInterval(function () {
      if (i >= nodes.length - 1) {
        window.clearInterval(timer);
        timer = null;
        if (status) status.textContent = 'Composing your assessment.';
        return;
      }
      nodes[i].removeAttribute('data-state');
      nodes[i].setAttribute('data-state', 'done');
      i++;
      nodes[i].setAttribute('data-state', 'active');
      if (status) status.textContent = 'Reading ' + MARKERS[i][1].toLowerCase() + '.';
    }, 2200);

    return {
      stop: function () {
        if (timer) window.clearInterval(timer);
        timer = null;
      }
    };
  }

  /* ---------- submit -------------------------------------------------------- */

  function usable(r) {
    if (!r || typeof r !== 'object') return false;
    if (typeof r.overallScore === 'number') return true;
    if (typeof r.summary === 'string' && r.summary.trim()) return true;
    if (r.photoAnalysis && typeof r.photoAnalysis === 'object' && Object.keys(r.photoAnalysis).length) return true;
    if (Array.isArray(r.productRecommendations) && r.productRecommendations.length) return true;
    return false;
  }

  function fail(message) {
    var box = $('zl-a-error-msg');
    if (box) {
      if (message) { box.textContent = 'Reported: ' + message; box.hidden = false; }
      else { box.textContent = ''; box.hidden = true; }
    }
    show('error');
  }

  function submit() {
    if (!state.photo) { show('photo'); return; }
    if (scanImg) scanImg.src = state.photo;
    show('working');

    var work = startWorking();
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timedOut = false;
    var timer = window.setTimeout(function () {
      timedOut = true;
      if (ctrl) { try { ctrl.abort(); } catch (e) {} }
    }, TIMEOUT);

    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: state.answers, photoBase64: state.photo })
    };
    if (ctrl) opts.signal = ctrl.signal;

    fetch(API, opts)
      .then(function (r) {
        return r.text().then(function (text) {
          var body = null;
          try { body = JSON.parse(text); } catch (e) { /* not JSON */ }
          if (!r.ok) {
            throw new Error((body && (body.error || body.message)) || ('the analysis service replied with status ' + r.status + '.'));
          }
          if (!body) throw new Error('the analysis service sent a reply this page could not read.');
          if (body.error) throw new Error(String(body.error));
          return body;
        });
      })
      .then(function (report) {
        if (!usable(report)) throw new Error('the analysis service returned an assessment with nothing in it.');
        window.clearTimeout(timer);
        work.stop();
        /* Hold the Worker's signature over this exact report. Asking for it by
           email later replays these three values; the Worker will not send an
           assessment it cannot prove it wrote, which is what stops the endpoint
           being a way to mail anything to anyone from our domain. */
        state.receipt = (report._signature && report._payload)
          ? { payload: report._payload, signature: report._signature, issuedAt: report._issuedAt }
          : null;
        renderReport(report);
        show('results');
      })
      .catch(function (err) {
        window.clearTimeout(timer);
        work.stop();
        // Never a fabricated report in place of a failure.
        if (timedOut) {
          fail('the analysis service did not answer within 75 seconds.');
        } else if (err && err.name === 'AbortError') {
          fail('the request was interrupted before it finished.');
        } else if (err instanceof TypeError) {
          fail('the connection to the analysis service could not be made — often a network, VPN or firewall problem.');
        } else {
          fail((err && err.message) ? err.message : 'an unknown problem occurred.');
        }
      });
  }

  /* ---------- the assessment ------------------------------------------------ */

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function section(index, title, body) {
    var sec = h('section', 'zl-a-sec');
    var head = h('div', 'zl-a-sec__head');
    head.appendChild(h('span', 'zl-a-sec__n', pad(index)));
    head.appendChild(h('h3', 'zl-a-sec__t', title));
    sec.appendChild(head);
    sec.appendChild(body);
    return sec;
  }

  function matchProduct(name) {
    var s = String(name || '');
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].re.test(s)) return PRODUCTS[i];
    }
    return null;
  }

  function renderReport(r) {
    var host = $('zl-a-report');
    if (!host) return;
    host.innerHTML = '';

    var dateEl = $('zl-a-date');
    if (dateEl) {
      try {
        dateEl.textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch (e) { dateEl.textContent = ''; }
    }

    /* Show the reader their own photograph beside the assessment it produced.
       state.photo is the resized data URL already held in memory — the same one
       that was read — so this displays what was actually analysed and uploads
       nothing further. The photo step is optional, so the figure stays hidden
       when there isn't one. */
    var shot = $('zl-a-rshot');
    var shotImg = $('zl-a-rshot-img');
    if (shot && shotImg) {
      if (state.photo) {
        shotImg.src = state.photo;
        shot.hidden = false;
      } else {
        shotImg.removeAttribute('src');
        shot.hidden = true;
      }
    }

    var order = 0;   // sequences the entrance animation
    var secNo = 0;   // numbers the written sections, 01, 02, 03 …
    function add(node) { node.style.setProperty('--i', String(order)); host.appendChild(node); order++; }
    function no() { secNo++; return secNo; }

    /* score */
    if (typeof r.overallScore === 'number' && isFinite(r.overallScore)) {
      var outOf = r.overallScore > 10 ? 100 : 10;
      var pct = Math.max(0, Math.min(100, (r.overallScore / outOf) * 100));

      var block = h('div', 'zl-a-score');
      var fig = h('div', 'zl-a-score__fig');
      fig.appendChild(h('span', 'zl-a-score__num', String(r.overallScore)));
      fig.appendChild(h('span', 'zl-a-score__of', '/ ' + outOf));
      block.appendChild(fig);

      var right = h('div');
      right.appendChild(h('p', 'zl-a-score__label', r.scoreLabel || 'Your skin longevity reading'));
      var scale = h('div', 'zl-a-scale');
      var fill = h('span', 'zl-a-scale__fill');
      var dot = h('span', 'zl-a-scale__dot');
      scale.appendChild(fill);
      scale.appendChild(dot);
      right.appendChild(scale);
      right.appendChild(h('p', 'zl-a-score__note',
        'A single reading of how your skin presents today, taken across the eight markers below. It describes appearance — it is not a diagnosis, and it is not a score you are meant to chase.'));
      block.appendChild(right);
      add(block);

      window.setTimeout(function () {
        fill.style.width = pct + '%';
        dot.style.left = pct + '%';
      }, 260);
    }

    /* summary */
    if (typeof r.summary === 'string' && r.summary.trim()) {
      add(section(no(), 'In summary', h('p', 'zl-a-lede', r.summary)));
    }

    /* the eight markers */
    if (r.photoAnalysis && typeof r.photoAnalysis === 'object') {
      var grid = h('div', 'zl-a-mks');
      var written = 0;
      MARKERS.forEach(function (m, i) {
        var text = r.photoAnalysis[m[0]];
        if (!text) return;
        var card = h('div', 'zl-a-mk');
        var t = h('h4', 'zl-a-mk__t');
        t.appendChild(h('span', 'zl-a-mk__n', pad(i + 1)));
        t.appendChild(h('span', null, m[1]));
        card.appendChild(t);
        card.appendChild(h('p', 'zl-a-mk__d', String(text)));
        grid.appendChild(card);
        written++;
      });
      if (written) add(section(no(), 'What the photograph shows', grid));
    }

    /* root causes */
    if (Array.isArray(r.rootCauses) && r.rootCauses.length) {
      var causes = h('div');
      r.rootCauses.forEach(function (c, i) {
        if (!c) return;
        var row = h('div', 'zl-a-cause');
        row.appendChild(h('span', 'zl-a-cause__n', pad(i + 1)));
        row.appendChild(h('h4', 'zl-a-cause__t', c.factor || 'Contributing factor'));
        if (c.explanation) row.appendChild(h('p', 'zl-a-cause__d', c.explanation));
        causes.appendChild(row);
      });
      add(section(no(), 'What appears to be driving it', causes));
    }

    /* what to do */
    if (Array.isArray(r.lifestyleRecommendations) && r.lifestyleRecommendations.length) {
      var ul = h('ul', 'zl-a-do');
      r.lifestyleRecommendations.forEach(function (t) {
        if (t) ul.appendChild(h('li', null, String(t)));
      });
      add(section(no(), 'What to do about it', ul));
    }

    /* the formulations that follow */
    if (Array.isArray(r.productRecommendations) && r.productRecommendations.length) {
      var rows = r.productRecommendations.filter(Boolean).map(function (p) {
        return { p: p, match: matchProduct(p.product || p.name) };
      });
      rows.sort(function (a, b) {
        var av = a.match ? parseInt(a.match.step, 10) : 99;
        var bv = b.match ? parseInt(b.match.step, 10) : 99;
        return av - bv;
      });

      var list = h('div', 'zl-a-rx');
      rows.forEach(function (row) {
        var item = h('article', 'zl-a-rx__item');
        item.appendChild(h('span', 'zl-a-rx__step', row.match ? 'Step ' + row.match.step : 'Also'));

        var body = h('div');
        var name = h('h4', 'zl-a-rx__name', row.match ? row.match.name : String(row.p.product || row.p.name || 'A formulation'));
        body.appendChild(name);
        if (row.match) body.appendChild(h('span', 'zl-a-rx__role', row.match.role));
        if (row.p.why) body.appendChild(h('p', 'zl-a-rx__why', String(row.p.why)));

        if (row.match) {
          var links = h('div', 'zl-a-rx__links');
          var a1 = h('a', 'zl-link', 'Read the formulation');
          a1.href = '/products/' + row.match.slug;
          var a2 = h('a', 'zl-link', 'Step ' + row.match.step + ' of the protocol');
          a2.href = '/protocol#step-' + row.match.step;
          links.appendChild(a1);
          links.appendChild(a2);
          body.appendChild(links);
        }
        item.appendChild(body);
        list.appendChild(item);
      });

      var foot = h('p', 'zl-a-score__note');
      foot.style.marginTop = '1.5rem';
      foot.textContent = 'Listed in protocol order, which is the order they are used in. The collection is in pre-launch and not yet available to purchase.';
      list.appendChild(foot);

      add(section(no(), 'The formulations that follow', list));
    }

    /* what to expect */
    if (typeof r.expectedResults === 'string' && r.expectedResults.trim()) {
      add(section(no(), 'What to expect', h('p', 'zl-a-lede', r.expectedResults)));
    }

    /* the service's own closing note */
    if (typeof r.consultationNote === 'string' && r.consultationNote.trim()) {
      var note = h('div', 'zl-a-sec');
      note.appendChild(h('p', 'zl-a-lede', r.consultationNote));
      add(note);
    }
  }

  /* ---------- wiring -------------------------------------------------------- */

  function beginQuiz() {
    if (!state.answers || !Object.keys(state.answers).length) {
      state.step = 0;
      state.reached = 0;
    }
    show('quiz');
    renderQuestion();
  }

  var startBtn = $('zl-a-start');
  if (startBtn) startBtn.addEventListener('click', beginQuiz);
  var startBtn2 = $('zl-a-start-2');
  if (startBtn2) startBtn2.addEventListener('click', beginQuiz);

  if (nextBtn) nextBtn.addEventListener('click', next);
  if (backBtn) backBtn.addEventListener('click', back);

  var photoBack = $('zl-a-photo-back');
  if (photoBack) photoBack.addEventListener('click', function () {
    state.step = QUESTIONS.length - 1;
    show('quiz');
    renderQuestion();
  });

  if (analyseBtn) analyseBtn.addEventListener('click', submit);

  var retryBtn = $('zl-a-retry');
  if (retryBtn) retryBtn.addEventListener('click', submit);

  var errPhoto = $('zl-a-error-photo');
  if (errPhoto) errPhoto.addEventListener('click', function () {
    resetPhoto();
    show('photo');
  });

  var printBtn = $('zl-a-print');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  var restart = $('zl-a-restart');
  if (restart) restart.addEventListener('click', function () {
    state = { step: 0, reached: 0, answers: {}, photo: null, photoMeta: '', receipt: null };
    resetPhoto();
    updateRail();
    show('intro');
  });

  /* ---- "Send it to me" -------------------------------------------------
     zl.js already handles this form's Netlify submission and its success
     message; this listener runs alongside it and does the one extra thing —
     asks the Worker to post the assessment out. Both listeners fire on the
     same submit event: neither calls stopImmediatePropagation, and zl.js's
     preventDefault only stops the browser navigating.

     The email is best-effort by design. If it fails, the address is still on
     the waitlist and the reader still has the report on screen and a Print or
     save as PDF button, so the worst case is a missing convenience, not a lost
     lead. It says so rather than pretending. */
  var keepForm = $('zl-a-keep-form');
  if (keepForm) {
    keepForm.addEventListener('submit', function () {
      var field = keepForm.querySelector('input[type="email"]');
      var email = field && field.value && field.value.trim();
      var note = $('zl-a-keep-note');
      if (!email) return;

      if (!state.receipt) {
        if (note) note.textContent = 'You are on the list. This assessment could not be sent by email — print or save it from the link below.';
        return;
      }
      if (note) note.textContent = 'Sending your assessment to ' + email + '…';

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'email',
          email: email,
          report: state.receipt.payload,
          signature: state.receipt.signature,
          issuedAt: state.receipt.issuedAt
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (b) {
          if (!r.ok || b.error) throw new Error(b.error || ('status ' + r.status));
          if (note) note.textContent = 'Sent. Your assessment is on its way to ' + email + '.';
        });
      }).catch(function () {
        if (note) {
          note.textContent = 'You are on the list, but the assessment could not be emailed just now. '
            + 'Use “Print or save as PDF” below to keep a copy.';
        }
      });
    });
  }

  buildRail();
  show('intro');
})();
