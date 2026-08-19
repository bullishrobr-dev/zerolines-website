#!/usr/bin/env python3
"""place-inline.py <map.json>
map: { "<slug>": { "inline1": {"asset": "<base>", "after": "<h2 id>", "alt": "..."},
                   "inline2": {"asset": "<base>", "after": "<h2 id>", "alt": "..."} } }
Inserts, per article:
  · inline1 as an --aside figure immediately after its h2 (prose runs beside it)
  · a pull-quote — the article's first "In short" bullet — after the NEXT h2
  · inline2 as a --wide figure at the end of its h2's section
Idempotent: an article already carrying a figure is skipped."""
import json, io, re, sys, html
m = json.load(io.open(sys.argv[1]))
done = skipped = 0
for slug, spec in m.items():
    f = f'blog/{slug}.html'
    try: s = io.open(f, encoding='utf-8').read()
    except FileNotFoundError: print("  missing", f); continue
    if 'zl-blog-figure' in s: skipped += 1; continue
    i1, i2 = spec.get('inline1'), spec.get('inline2')
    # first In-short bullet, for the pull
    pull = ''
    mm = re.search(r'class="zl-blog-inshort".*?<li>(.*?)</li>', s, re.S)
    if mm:
        t = re.sub(r'<[^>]+>', '', mm.group(1)).strip()
        if 40 <= len(t) <= 220: pull = t
    h2s = [(x.group(1), x.start(), x.end()) for x in re.finditer(r'<h2\b[^>]*id="([^"]+)"[^>]*>.*?</h2>', s, re.S)]
    ids = [h[0] for h in h2s]
    def h2_end(hid):
        for hid2, st, en in h2s:
            if hid2 == hid: return en
        return None
    def section_end(hid):
        for k, (hid2, st, en) in enumerate(h2s):
            if hid2 == hid:
                return h2s[k+1][1] if k+1 < len(h2s) else None
        return None
    edits = []   # (pos, html) — applied from the back
    if i1 and i1['after'] in ids:
        fig = (f'\n      <figure class="zl-blog-figure zl-blog-figure--aside" data-reveal="fade">'
               f'<img src="/assets/{i1["asset"]}.webp" alt="{html.escape(i1["alt"],quote=True)}" loading="lazy" decoding="async"></figure>\n')
        edits.append((h2_end(i1['after']), fig))
        # the pull after the next h2
        k = ids.index(i1['after'])
        if pull and k+1 < len(ids):
            edits.append((h2_end(ids[k+1]), f'\n      <blockquote class="zl-blog-pull" data-reveal="fade"><p>{html.escape(pull)}</p></blockquote>\n'))
    if i2 and i2['after'] in ids:
        end = section_end(i2['after'])
        fig = (f'\n      <figure class="zl-blog-figure zl-blog-figure--wide" data-reveal="fade">'
               f'<img src="/assets/{i2["asset"]}.webp" alt="{html.escape(i2["alt"],quote=True)}" loading="lazy" decoding="async"></figure>\n')
        if end is None:
            # last section: before the analyser block or sources, whichever comes first
            cands = [s.find(x) for x in ['<div class="zl-blog-ai-analyst"', '<div class="zl-blog-sources"'] if s.find(x) > 0]
            end = min(cands) if cands else None
        if end: edits.append((end, fig))
    for pos, frag in sorted(edits, key=lambda e: -e[0]):
        s = s[:pos] + frag + s[pos:]
    io.open(f, 'w', encoding='utf-8').write(s); done += 1
print(f"  articles updated: {done}   already had figures: {skipped}")
