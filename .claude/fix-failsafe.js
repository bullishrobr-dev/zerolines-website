/* Replace the reveal failsafe with a correctly scoped version.
 *
 * v1 revealed EVERY element sitting at inline opacity:0. That included the
 * full-screen mobile menu overlay, which is legitimately parked at opacity:0
 * when closed — so it unhid itself over the page. Same mistake, incidentally,
 * that the old build made in reverse.
 *
 * v2 only touches elements that are part of the document flow: it skips
 * anything positioned fixed, anything marked aria-hidden or role=dialog, and
 * anything large enough to be an overlay. Content that scrolls with the page
 * gets revealed; chrome that floats above it is left exactly as the app set it.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = ['science', 'story', 'protocol', 'testimonials', 'contact'];
const MARKER = 'zl-reveal-failsafe';

const SNIPPET = `<script data-patch="${MARKER}">
(function () {
  // The legacy GSAP timeline on this page errors and strands content elements
  // at opacity:0 permanently. Reveal those — but only real page content.
  // Overlays (menu, modals, cookie bar) are hidden on purpose; leave them.
  function isOverlay(el) {
    var cs = getComputedStyle(el);
    if (cs.position === 'fixed') return true;
    if (el.closest('[aria-hidden="true"], [role="dialog"], [data-overlay]')) return true;
    var r = el.getBoundingClientRect();
    // something as large as the viewport in both axes is chrome, not a paragraph
    if (r.width >= innerWidth * 0.92 && r.height >= innerHeight * 0.85) return true;
    return false;
  }

  function sweep() {
    var nodes = document.querySelectorAll('[style*="opacity"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (parseFloat(el.style.opacity) !== 0) continue;
      if (isOverlay(el)) continue;
      el.style.opacity = '1';
      if (/translate|matrix/.test(el.style.transform || '')) el.style.transform = 'none';
    }
  }

  function start() {
    setTimeout(sweep, 1800);
    setTimeout(sweep, 3500);
    setTimeout(sweep, 6000);
    var t;
    window.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(sweep, 900);
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
</script>`;

let done = 0;
for (const dir of PAGES) {
  const file = path.join(ROOT, dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');

  const re = new RegExp(`<script data-patch="${MARKER}">[\\s\\S]*?<\\/script>`, 'g');
  if (!re.test(html)) { console.log(`${dir}: no v1 patch found`); continue; }
  html = html.replace(re, SNIPPET);
  fs.writeFileSync(file, html);
  done++;
}
console.log(`reveal failsafe replaced on ${done} page(s)`);
