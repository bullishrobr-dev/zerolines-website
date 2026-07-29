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
  // Walking ancestor background-color ONLY is how this checker previously
  // reported contrastFails=0 for hero copy sitting on a bare photograph: the
  // ancestors were all transparent, so it fell through to the page bone and
  // declared the text legible. Text over imagery has to be treated as unknown
  // rather than silently assumed to be on the page colour.
  function backdrop(el){
    let n = el;
    while(n && n !== document.documentElement){
      const cs = getComputedStyle(n);
      if(cs.backgroundImage && cs.backgroundImage !== 'none') return { overImage: true };
      const bg = parse(cs.backgroundColor);
      if(bg && bg.a === 1) return { rgb: [bg.r,bg.g,bg.b] };
      n = n.parentElement;
    }
    return { rgb: [255,255,255] };
  }

  // Is this text painted OVER an image, rather than merely near one?
  //
  // Geometric containment alone over-reports badly: a product card's name sits
  // below its picture but a large editorial image elsewhere on the page can still
  // enclose its rect. The distinguishing property of a genuine backdrop is that
  // it is taken out of flow — in this design decorative images always live in an
  // absolutely-positioned wrapper, while content images sit in normal flow.
  function overPhoto(el){
    const r = el.getBoundingClientRect();
    if(r.width === 0 || r.height === 0) return false;

    for(const img of document.images){
      const ir = img.getBoundingClientRect();
      if(ir.width < 200 || ir.height < 200) continue;
      if(img.contains(el) || el.contains(img)) continue;

      const covers = ir.left <= r.left+2 && ir.right >= r.right-2 &&
                     ir.top  <= r.top+2  && ir.bottom >= r.bottom-2;
      if(!covers) continue;

      // the image, or a wrapper above it, must be out of flow to be a backdrop
      let outOfFlow = false;
      for(let n = img; n && n !== document.body; n = n.parentElement){
        const pos = getComputedStyle(n).position;
        if(pos === 'absolute' || pos === 'fixed'){ outOfFlow = true; break; }
      }
      if(outOfFlow) return true;
    }
    return false;
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
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight,10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const label = el.tagName.toLowerCase() + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');
    const snippet = (el.textContent||'').trim().slice(0,42);

    const bd = backdrop(el);
    if(bd.overImage || overPhoto(el)){
      // Cannot be computed from styles. Report it so a human looks, rather than
      // scoring it against a page colour that is not actually behind the text.
      fails.push({ sel: label, text: snippet, ratio: null, need, size: Math.round(size), overImage: true });
      continue;
    }

    const bg = bd.rgb;
    const comp = over(fg, {r:bg[0],g:bg[1],b:bg[2]});
    const L1 = lum(comp), L2 = lum(bg);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    if(ratio + 0.005 < need){
      fails.push({ sel: label, text: snippet, ratio: +ratio.toFixed(2), need, size: Math.round(size) });
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

      const overImg = fails.filter((f) => f.overImage);
      const measured = fails.filter((f) => !f.overImage);
      totalFails -= overImg.length;   // counted separately below

      console.log(`${p} [${label}]  contrastFails=${measured.length}` +
        (overImg.length ? `  textOverImage=${overImg.length}` : '') +
        (flags.length ? '  ⚠ ' + flags.join(' | ') : ''));
      measured.slice(0, 6).forEach((f) => console.log(`      ${f.ratio}:1 (needs ${f.need}) ${f.size}px  ${f.sel}  "${f.text}"`));
      if (measured.length > 6) console.log(`      … and ${measured.length - 6} more`);
      overImg.slice(0, 4).forEach((f) => console.log(`      OVER IMAGE — check by eye: ${f.size}px ${f.sel}  "${f.text}"`));
      if (overImg.length > 4) console.log(`      … and ${overImg.length - 4} more over imagery`);

      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\ntotal contrast failures: ${totalFails}`);
  process.exit(totalFails > 0 ? 1 : 0);
})();
