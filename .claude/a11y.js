/* Measure real contrast in-page across a set of paths, plus check the two
 * occlusion bugs the audit found (header ghosting, cookie notice covering CTAs).
 * Usage: node .claude/a11y.js [path ...]
 */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8420';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];

const MEASURE = `(() => {
  function lum(c){
    const s = c.map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
    return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2];
  }
  function parse(str){
    const m = str.match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    const p = m[1].split(',').map(s=>parseFloat(s));
    return { r:p[0], g:p[1], b:p[2], a:p.length>3?p[3]:1 };
  }
  function over(fg,bg){ // composite fg (with alpha) onto opaque bg
    return [ fg.r*fg.a + bg.r*(1-fg.a), fg.g*fg.a + bg.g*(1-fg.a), fg.b*fg.a + bg.b*(1-fg.a) ];
  }
  function backdrop(el){
    let n = el;
    while(n && n !== document.documentElement){
      const bg = parse(getComputedStyle(n).backgroundColor);
      if(bg && bg.a === 1) return [bg.r,bg.g,bg.b];
      n = n.parentElement;
    }
    return [255,255,255];
  }
  const fails = [];
  const nodes = document.querySelectorAll('body *');
  for(const el of nodes){
    if(!el.offsetHeight) continue;
    const direct = [...el.childNodes].some(n => n.nodeType===3 && n.textContent.trim());
    if(!direct) continue;
    const cs = getComputedStyle(el);
    if(cs.visibility==='hidden' || cs.display==='none' || parseFloat(cs.opacity)===0) continue;
    const fg = parse(cs.color); if(!fg) continue;
    const bg = backdrop(el);
    const comp = over(fg, {r:bg[0],g:bg[1],b:bg[2]});
    const L1 = lum(comp), L2 = lum(bg);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight,10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if(ratio + 0.005 < need){
      fails.push({
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
        text: (el.textContent||'').trim().slice(0,42),
        ratio: +ratio.toFixed(2), need, size: Math.round(size)
      });
    }
  }
  return fails;
})()`;

(async () => {
  const browser = await chromium.launch();
  let totalFails = 0;

  for (const p of paths) {
    for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, isMobile: label === 'mobile' });
      const page = await ctx.newPage();
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        const s = innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += s) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
      });
      await page.waitForTimeout(1200);

      const fails = await page.evaluate(MEASURE);
      totalFails += fails.length;

      // header occlusion: is any page text readable through the header band?
      const ghost = await page.evaluate(() => {
        const h = document.querySelector('.zl-header');
        if (!h) return null;
        const cs = getComputedStyle(h);
        const bg = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        const a = bg ? (bg[1].split(',').length > 3 ? parseFloat(bg[1].split(',')[3]) : 1) : 0;
        return { scrolled: h.getAttribute('data-scrolled'), alpha: a, opaque: a === 1 };
      });

      // cookie occlusion: is any interactive element covered by the notice?
      const covered = await page.evaluate(() => {
        const c = document.getElementById('zl-cookie');
        if (!c || c.getAttribute('data-open') !== 'true') return [];
        const r = c.getBoundingClientRect();
        const out = [];
        document.querySelectorAll('a[href], button, input').forEach((el) => {
          if (el.closest('#zl-cookie')) return;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          if (b.bottom < r.top || b.top > r.bottom || b.right < r.left || b.left > r.right) return;
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          if (hit && hit.closest('#zl-cookie')) {
            out.push((el.textContent || el.name || el.tagName).trim().slice(0, 30));
          }
        });
        return out;
      });

      const flags = [];
      if (ghost && ghost.scrolled === 'true' && !ghost.opaque) flags.push(`header not opaque when scrolled (alpha ${ghost.alpha})`);
      if (covered.length) flags.push(`cookie notice covers: ${covered.join(', ')}`);

      console.log(`${p} [${label}]  contrastFails=${fails.length}${flags.length ? '  ⚠ ' + flags.join(' | ') : ''}`);
      fails.slice(0, 6).forEach((f) => console.log(`      ${f.ratio}:1 (needs ${f.need}) ${f.size}px  ${f.sel}  "${f.text}"`));
      if (fails.length > 6) console.log(`      … and ${fails.length - 6} more`);

      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\ntotal contrast failures: ${totalFails}`);
  process.exit(totalFails > 0 ? 1 : 0);
})();
