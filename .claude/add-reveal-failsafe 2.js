/* Stop the legacy React pages hiding their own content.
 *
 * science/ story/ protocol/ testimonials/ contact/ still render from the old
 * React + GSAP bundle. Its scroll-reveal timeline throws ("GSAP target
 * undefined not found") and leaves elements parked at the pre-animation state —
 * inline opacity:0 with a translate — which they never leave. Measured on
 * /science: 53 elements invisible at desktop, 57 at mobile.
 *
 * These pages need rebuilding as static HTML, but until then this guarantees
 * the content is readable. A short observer sweeps anything still at opacity:0
 * once the page has had time to animate, and keeps sweeping briefly to catch
 * elements React mounts late. It only ever makes content MORE visible, so it
 * cannot itself hide anything.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = ['science', 'story', 'protocol', 'testimonials', 'contact'];
const MARKER = 'zl-reveal-failsafe';

const SNIPPET = `
<script data-patch="${MARKER}">
(function () {
  // Failsafe: the legacy GSAP timeline on this page errors and strands elements
  // at opacity:0 forever. Reveal anything still hidden once animation has had
  // its chance. Never hides — only shows.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) sweep();

  function sweep() {
    var n = 0;
    var nodes = document.querySelectorAll('[style*="opacity"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (parseFloat(el.style.opacity) !== 0) continue;
      el.style.opacity = '1';
      if (/translate|matrix/.test(el.style.transform || '')) el.style.transform = 'none';
      n++;
    }
    return n;
  }

  function start() {
    setTimeout(sweep, 1800);
    setTimeout(sweep, 3500);
    setTimeout(sweep, 6000);
    // also sweep after any scroll settles, for late-mounted sections
    var t;
    window.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(sweep, 900);
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
</script>
</body>`;

let done = 0;
for (const dir of PAGES) {
  const file = path.join(ROOT, dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(MARKER)) { console.log(`${dir}: already patched`); continue; }
  if (!html.includes('</body>')) { console.log(`${dir}: no </body>, skipped`); continue; }
  html = html.replace(/<\/body>/, SNIPPET);
  fs.writeFileSync(file, html);
  done++;
}
console.log(`reveal failsafe added to ${done} page(s)`);
