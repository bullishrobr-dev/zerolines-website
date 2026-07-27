/* ============================================================================
   ZERO LINES — Skin Analyser

   Replaces the ~600 lines of quiz engine that lived inside the old homepage.
   Same contract with the Cloudflare Worker: POST { answers, photoBase64 } and
   receive a structured report back.

   Questions are injected as JSON from the page so this file stays generic.
   ========================================================================= */
(function () {
  'use strict';

  var API = 'https://lively-surf-87db.bullishrobr.workers.dev/';
  var MAX_BYTES = 4 * 1024 * 1024;      // worker rejects much beyond this
  var MAX_EDGE = 1400;                  // downscale before upload

  var QUESTIONS = [];
  try {
    QUESTIONS = JSON.parse(document.getElementById('zl-quiz-data').textContent);
  } catch (e) { return; }

  var state = { step: -1, answers: {}, photo: null };

  var el = {};
  ['intro', 'quiz', 'photo', 'working', 'results', 'error'].forEach(function (k) {
    el[k] = document.getElementById('zl-a-' + k);
  });
  var qHost = document.getElementById('zl-a-question');
  var progress = document.getElementById('zl-a-progress');
  var backBtn = document.getElementById('zl-a-back');
  var nextBtn = document.getElementById('zl-a-next');

  function show(name) {
    ['intro', 'quiz', 'photo', 'working', 'results', 'error'].forEach(function (k) {
      if (el[k]) el[k].hidden = k !== name;
    });
    var top = document.getElementById('zl-a-top');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- questions ---------------------------------------------------- */

  function current() { return QUESTIONS[state.step]; }

  function answered(q) {
    var v = state.answers[q.id];
    if (q.multi) return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }

  function renderQuestion() {
    var q = current();
    if (!q) return;

    progress.textContent = 'Question ' + (state.step + 1) + ' of ' + QUESTIONS.length;
    progress.style.setProperty('--p', ((state.step + 1) / QUESTIONS.length) * 100 + '%');

    var frag = document.createDocumentFragment();

    var h = document.createElement('h2');
    h.className = 'zl-display-m';
    h.id = 'zl-a-qtitle';
    h.textContent = q.question;
    frag.appendChild(h);

    var list = document.createElement('div');
    list.className = 'zl-a-options';
    list.setAttribute('role', q.multi ? 'group' : 'radiogroup');
    list.setAttribute('aria-labelledby', 'zl-a-qtitle');

    q.options.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zl-a-option';
      b.textContent = opt.label;
      b.setAttribute('role', q.multi ? 'checkbox' : 'radio');

      var sel = q.multi
        ? (state.answers[q.id] || []).indexOf(opt.value) > -1
        : state.answers[q.id] === opt.value;
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
      if (sel) b.setAttribute('data-selected', 'true');

      b.addEventListener('click', function () {
        if (q.multi) {
          var arr = state.answers[q.id] || [];
          var at = arr.indexOf(opt.value);
          if (at > -1) arr.splice(at, 1);
          else if (!q.max || arr.length < q.max) arr.push(opt.value);
          state.answers[q.id] = arr;
          renderQuestion();
        } else {
          state.answers[q.id] = opt.value;
          renderQuestion();
          // single-choice advances on its own — fewer clicks, feels responsive
          setTimeout(next, 240);
        }
      });
      list.appendChild(b);
    });

    frag.appendChild(list);

    if (q.multi) {
      var hint = document.createElement('p');
      hint.className = 'zl-muted';
      hint.style.cssText = 'font-size:.8125rem;margin-top:1rem';
      hint.textContent = q.max
        ? 'Select up to ' + q.max + '.'
        : 'Select all that apply, or continue to skip.';
      frag.appendChild(hint);
    }

    qHost.innerHTML = '';
    qHost.appendChild(frag);

    backBtn.hidden = state.step === 0;
    // optional multi-selects can always be skipped; single choices need an answer
    nextBtn.disabled = !q.multi && !answered(q);
    nextBtn.textContent = state.step === QUESTIONS.length - 1 ? 'Continue to photo' : 'Continue';
  }

  function next() {
    if (state.step < QUESTIONS.length - 1) {
      state.step++;
      renderQuestion();
    } else {
      show('photo');
    }
  }
  function back() {
    if (state.step > 0) { state.step--; renderQuestion(); }
  }

  /* ---------- photo -------------------------------------------------------- */

  var fileInput = document.getElementById('zl-a-file');
  var dropZone = document.getElementById('zl-a-drop');
  var preview = document.getElementById('zl-a-preview');
  var previewImg = document.getElementById('zl-a-preview-img');
  var analyseBtn = document.getElementById('zl-a-analyse');
  var photoErr = document.getElementById('zl-a-photo-error');

  function downscale(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That does not look like an image.')); };
        img.onload = function () {
          var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function acceptFile(file) {
    photoErr.textContent = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      photoErr.textContent = 'Please choose an image file (JPG or PNG).';
      return;
    }
    if (file.size > MAX_BYTES * 3) {
      photoErr.textContent = 'That image is very large. Please choose one under about 10MB.';
      return;
    }
    downscale(file).then(function (dataUrl) {
      state.photo = dataUrl;
      previewImg.src = dataUrl;
      preview.hidden = false;
      dropZone.hidden = true;
      analyseBtn.disabled = false;
    }).catch(function (err) {
      photoErr.textContent = err.message;
    });
  }

  if (dropZone) {
    dropZone.addEventListener('click', function () { fileInput.click(); });
    dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
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

  var retake = document.getElementById('zl-a-retake');
  if (retake) retake.addEventListener('click', function () {
    state.photo = null;
    fileInput.value = '';
    preview.hidden = true;
    dropZone.hidden = false;
    analyseBtn.disabled = true;
  });

  /* ---------- submit ------------------------------------------------------- */

  var STEPS = [
    'Reading your responses',
    'Analysing the photograph',
    'Cross-referencing skin markers',
    'Building your protocol',
  ];

  function runWorkingAnimation() {
    var host = document.getElementById('zl-a-steps');
    if (!host) return null;
    host.innerHTML = '';
    var nodes = STEPS.map(function (s) {
      var li = document.createElement('li');
      li.className = 'zl-a-step';
      li.textContent = s;
      host.appendChild(li);
      return li;
    });
    var i = 0;
    nodes[0].setAttribute('data-active', 'true');
    return setInterval(function () {
      if (i < nodes.length - 1) {
        nodes[i].removeAttribute('data-active');
        nodes[i].setAttribute('data-done', 'true');
        i++;
        nodes[i].setAttribute('data-active', 'true');
      }
    }, 2400);
  }

  if (analyseBtn) analyseBtn.addEventListener('click', function () {
    if (!state.photo) return;
    show('working');
    var timer = runWorkingAnimation();

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: state.answers, photoBase64: state.photo }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) throw new Error(body && body.error ? body.error : 'Analysis failed (' + r.status + ')');
          return body;
        });
      })
      .then(function (report) {
        clearInterval(timer);
        renderReport(report);
        show('results');
      })
      .catch(function (err) {
        clearInterval(timer);
        // No fabricated fallback report. The old build silently served a mock
        // analysis behind a "Demo Mode" banner, which means people received a
        // made-up assessment of their face. Better to say the truth.
        var msg = document.getElementById('zl-a-error-msg');
        if (msg) msg.textContent = err.message || 'Something went wrong.';
        show('error');
      });
  });

  /* ---------- report ------------------------------------------------------- */

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function block(title, body) {
    var wrap = h('div', 'zl-a-block');
    wrap.appendChild(h('h3', 'zl-a-block__title', title));
    wrap.appendChild(h('p', null, body));
    return wrap;
  }

  function renderReport(r) {
    var host = document.getElementById('zl-a-report');
    host.innerHTML = '';

    if (typeof r.overallScore === 'number') {
      var scoreWrap = h('div', 'zl-a-score');
      var num = h('span', 'zl-a-score__num', String(r.overallScore));
      scoreWrap.appendChild(num);
      scoreWrap.appendChild(h('span', 'zl-a-score__of', '/ 10'));
      if (r.scoreLabel) scoreWrap.appendChild(h('p', 'zl-a-score__label', r.scoreLabel));
      host.appendChild(scoreWrap);
    }

    if (r.summary) {
      var s = h('div', 'zl-a-summary');
      s.appendChild(h('p', 'zl-lead', r.summary));
      host.appendChild(s);
    }

    if (r.photoAnalysis) {
      var grid = h('div', 'zl-a-grid');
      var LABELS = {
        texture: 'Texture', tone: 'Tone', hydration: 'Hydration', poreQuality: 'Pores',
        pigmentation: 'Pigmentation', wrinkles: 'Lines', elasticity: 'Elasticity', sunDamage: 'Sun damage',
      };
      Object.keys(LABELS).forEach(function (k) {
        if (r.photoAnalysis[k]) grid.appendChild(block(LABELS[k], r.photoAnalysis[k]));
      });
      var sec = h('section', 'zl-a-section');
      sec.appendChild(h('span', 'zl-eyebrow', 'Photograph'));
      sec.appendChild(grid);
      host.appendChild(sec);
    }

    if (Array.isArray(r.rootCauses) && r.rootCauses.length) {
      var rc = h('section', 'zl-a-section');
      rc.appendChild(h('span', 'zl-eyebrow', 'Root causes'));
      var list = h('div', 'zl-a-grid');
      r.rootCauses.forEach(function (c) { list.appendChild(block(c.factor, c.explanation)); });
      rc.appendChild(list);
      host.appendChild(rc);
    }

    if (Array.isArray(r.lifestyleRecommendations) && r.lifestyleRecommendations.length) {
      var lr = h('section', 'zl-a-section');
      lr.appendChild(h('span', 'zl-eyebrow', 'Lifestyle'));
      var ul = h('ul', 'zl-a-list');
      r.lifestyleRecommendations.forEach(function (t) { ul.appendChild(h('li', null, t)); });
      lr.appendChild(ul);
      host.appendChild(lr);
    }

    if (Array.isArray(r.productRecommendations) && r.productRecommendations.length) {
      var pr = h('section', 'zl-a-section');
      pr.appendChild(h('span', 'zl-eyebrow', 'Your protocol'));
      var pg = h('div', 'zl-a-grid');
      r.productRecommendations.forEach(function (p) { pg.appendChild(block(p.product, p.why)); });
      pr.appendChild(pg);
      host.appendChild(pr);
    }

    if (r.expectedResults) {
      var er = h('section', 'zl-a-section');
      er.appendChild(h('span', 'zl-eyebrow', 'What to expect'));
      er.appendChild(h('p', 'zl-lead', r.expectedResults));
      host.appendChild(er);
    }

    if (r.consultationNote) {
      var cn = h('div', 'zl-a-note');
      cn.appendChild(h('p', null, r.consultationNote));
      host.appendChild(cn);
    }
  }

  /* ---------- wiring ------------------------------------------------------- */

  var startBtn = document.getElementById('zl-a-start');
  if (startBtn) startBtn.addEventListener('click', function () {
    state.step = 0;
    show('quiz');
    renderQuestion();
  });
  if (nextBtn) nextBtn.addEventListener('click', next);
  if (backBtn) backBtn.addEventListener('click', back);

  var restart = document.getElementById('zl-a-restart');
  if (restart) restart.addEventListener('click', function () {
    state = { step: -1, answers: {}, photo: null };
    if (fileInput) fileInput.value = '';
    if (preview) preview.hidden = true;
    if (dropZone) dropZone.hidden = false;
    if (analyseBtn) analyseBtn.disabled = true;
    show('intro');
  });

  var retryBtn = document.getElementById('zl-a-retry');
  if (retryBtn) retryBtn.addEventListener('click', function () { show('photo'); });

  show('intro');
})();
