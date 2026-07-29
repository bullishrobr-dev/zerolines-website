/* The protocol stepper.
 *
 * Owner: "when you are watching one product and you want to go to the next one
 * ... you would scroll from side to side ... you can see stage two, stage three,
 * stage four, and click on any one of them."
 *
 * A thumb-throwable rail of all six steps sits near the foot of every product
 * page, with the current one marked. On desktop it lays out as a six-column
 * grid; below 1100px it becomes a snap-scrolling rail. zl.js brings the current
 * step into view on load so someone on step 05 is not left hunting for it.
 *
 * It also replaces the ad-hoc "comes before / comes after" blocks the pages had,
 * which only ever showed two neighbours and gave no sense of the whole system.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const STEPS = [
  { n: '01', slug: 'peeling-gel',    name: 'Renew',    product: 'Bio-Renewal Peeling Gel',            role: 'One evening a week. Clears the canvas.' },
  { n: '02', slug: 'syringe',        name: 'Activate', product: 'Precision Collagen Activation Syringe', role: 'One evening a week. The immediate smoothing.' },
  { n: '03', slug: 'serum',          name: 'Signal',   product: 'BioSignal Facial Serum',             role: 'Morning and night. Carries the signal.' },
  { n: '04', slug: 'day-cream',      name: 'Shield',   product: 'Environmental Shield Day Cream',     role: 'Every morning. Holds the day off.' },
  { n: '05', slug: 'night-cream',    name: 'Restore',  product: 'Renewal and Repair Night Cream',     role: 'Every night. Works with the repair cycle.' },
  { n: '06', slug: 'syringe-refill', name: 'Sustain',  product: 'Precision Collagen Activation Refill', role: 'Roughly once a year. Keeps it going.' },
];

function stepper(currentSlug) {
  const cards = STEPS.map((s) => {
    const isCurrent = s.slug === currentSlug;
    return `        <a class="zl-step" href="/products/${s.slug}"${isCurrent ? ' aria-current="step"' : ''}>
          <span class="zl-step__n">${s.n}</span>
          <span class="zl-step__name">${s.name}</span>
          <span class="zl-step__role">${s.role}</span>
        </a>`;
  }).join('\n');

  return `
<!-- ── The protocol, in sequence — swipe on touch, click to move ─────────── -->
<section class="zl-section zl-section--sm zl-tint" data-zl-stepper>
  <div class="zl-container">
    <div class="zl-index-rule" data-reveal>
      <span class="zl-index-rule__num">The Protocol</span>
      <span class="zl-eyebrow zl-eyebrow--bare">Where this one sits</span>
    </div>

    <div class="zl-split zl-split--wide-txt" style="align-items:end;margin-bottom:clamp(2rem,5vh,3rem)">
      <h2 class="zl-display-m" data-reveal style="max-width:16ch">
        Six steps, in <em class="zl-em--brand">order</em>.
      </h2>
      <p class="zl-lead" data-reveal style="--reveal-delay:120ms">
        Each formulation prepares the skin for the one after it. Move through the
        sequence below, or take the whole protocol at once.
      </p>
    </div>

    <span class="zl-rail-hint">Swipe</span>
    <div class="zl-rail" role="list" data-stagger>
${cards}
    </div>

    <div style="margin-top:clamp(1.5rem,4vh,2.5rem)" data-reveal>
      <a class="zl-link" href="/protocol">The full protocol <span class="zl-link__arrow" aria-hidden="true">&rarr;</span></a>
    </div>
  </div>
</section>
`;
}

let added = 0, replaced = 0;
for (const s of STEPS) {
  const file = path.join(ROOT, 'products', s.slug, 'index.html');
  if (!fs.existsSync(file)) { console.log(`  ! missing ${s.slug}`); continue; }
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // remove a previously-inserted stepper so this is re-runnable
  const existing = /\n<!-- ── The protocol, in sequence[\s\S]*?<\/section>\n/;
  if (existing.test(html)) { html = html.replace(existing, '\n'); replaced++; }

  // insert before the closing CTA section if we can find one, else before </main>
  const anchor = html.lastIndexOf('</main>');
  if (anchor === -1) { console.log(`  ! no </main> in ${s.slug}`); continue; }
  html = html.slice(0, anchor) + stepper(s.slug) + '\n' + html.slice(anchor);

  if (html !== before) { fs.writeFileSync(file, html); added++; }
}

console.log(`stepper added to ${added} product page(s)${replaced ? ` (${replaced} replaced)` : ''}`);
