/* /analyser/ is the old homepage, preserved because it carries the AI skin quiz
 * and ~600 lines of quiz engine that have not been ported yet.
 *
 * The quiz only unhides when zlIsQuizRoute() sees a path starting "/quiz", so at
 * /analyser/ the page renders the old React homepage instead of the analyser.
 * Rather than untangle the routing, override the predicate once the original is
 * defined and re-run the existing toggle. The page's own 2s safety interval then
 * keeps the module visible.
 */
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'analyser', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const MARKER = 'zl-analyser-route-patch';
if (html.includes(MARKER)) {
  console.log('already patched');
  process.exit(0);
}

const PATCH = `
<script data-patch="${MARKER}">
(function () {
  // This page IS the analyser now. Teach the legacy router that.
  function apply() {
    if (typeof window.zlIsQuizRoute !== 'function') return false;
    var original = window.zlIsQuizRoute;
    window.zlIsQuizRoute = function () {
      if (location.pathname.indexOf('/analyser') === 0) return true;
      return original.apply(this, arguments);
    };
    if (typeof window.zlToggleQuizModule === 'function') window.zlToggleQuizModule();
    return true;
  }
  if (!apply()) {
    var tries = 0;
    var t = setInterval(function () {
      if (apply() || ++tries > 80) clearInterval(t);
    }, 100);
  }
})();
</script>
</body>`;

if (!html.includes('</body>')) {
  console.error('no </body> found — aborting');
  process.exit(1);
}
html = html.replace(/<\/body>/, PATCH);
fs.writeFileSync(file, html);
console.log('patched analyser/index.html');
