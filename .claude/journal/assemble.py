#!/usr/bin/env python3
"""
Build journal articles from written content + the existing house template.

Every new article is assembled from blog/sleep-repairs-skin.html rather than
from a hand-written string, so the head, the schema blocks, the header, the
menu, the breadcrumbs and the footer are byte-identical to the twenty-five
already live. The only things that vary are the ones that should.

Deliberately NOT carried over: the FAQPage block. Every claims problem found in
this journal's structured data lived in a FAQ answer nobody could see — a dated
efficacy timeline, a consumer-panel result, a sun-protection claim. A block that
is invisible to the writer and quoted by search engines is a bad trade, and
these articles do without it.

  python3 .claude/journal/assemble.py written.json
"""
import json, re, io, sys, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATE = os.path.join(ROOT, 'blog', 'sleep-repairs-skin.html')

# Reused from the existing set, assigned by category so the journal keeps its
# visual grammar. Twenty images across twenty-five articles means some repeat,
# which is already true of the twenty-five live ones.
IMAGES = {
    'Science':     ['science-water-ripple', 'science-skin-macro-droplets', 'science-gel-filaments',
                    'science-peptides', 'science-researcher-lab'],
    'Ingredients': ['science-minerals', 'atmosphere-cream-texture', 'science-peptides',
                    'atmosphere-botanical-petal', 'science-gel-filaments'],
    'Routine':     ['atmosphere-application-ritual', 'atmosphere-morning-ritual',
                    'atmosphere-daily-ritual', 'hero-peeling-facial', 'atmosphere-spa-ritual'],
    'Lifestyle':   ['atmosphere-spa-ritual', 'model-neck-detail', 'hero-editorial-1',
                    'atmosphere-daily-ritual', 'atmosphere-morning-ritual'],
    'Brand Story': ['story-barcelona-architecture', 'science-researcher-lab',
                    'story-pyrenean-mountains-dawn', 'story-springs', 'story-pyrenees-to-sea'],
}
ALT = {
    'science-water-ripple': 'Water surface in motion', 'science-skin-macro-droplets': 'Droplets on skin, close up',
    'science-gel-filaments': 'Gel filaments', 'science-peptides': 'Peptide structures',
    'science-researcher-lab': 'A researcher at the bench', 'science-minerals': 'Mineral crystals',
    'atmosphere-cream-texture': 'Cream texture', 'atmosphere-botanical-petal': 'Botanical petals',
    'atmosphere-application-ritual': 'Applying a formulation', 'atmosphere-morning-ritual': 'A morning routine',
    'atmosphere-daily-ritual': 'A daily ritual', 'atmosphere-spa-ritual': 'A quiet interior',
    'hero-peeling-facial': 'A facial in progress', 'hero-editorial-1': 'Editorial portrait',
    'model-neck-detail': 'Neck and jawline', 'story-barcelona-architecture': 'Barcelona architecture',
    'story-pyrenean-mountains-dawn': 'The Pyrenees at dawn', 'story-springs': 'An alpine spring',
    'story-pyrenees-to-sea': 'From the mountains to the sea',
}
CATEGORY_FILE = {
    'Science': 'category-science.html', 'Ingredients': 'category-ingredients.html',
    'Lifestyle': 'category-lifestyle.html', 'Routine': 'category-routine.html',
    'Brand Story': 'category-brand-story.html',
}

esc = lambda s: (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                 .replace('"', '&quot;'))


def block(src, marker, opener='<div', closer='</div>'):
    """Lift a self-contained block out of the template by its class marker."""
    i = src.find(marker)
    if i < 0:
        return None
    start = src.rfind(opener, 0, i)
    depth, j = 0, start
    while j < len(src):
        if src.startswith(opener, j):
            depth += 1
        elif src.startswith(closer, j):
            depth -= 1
            if depth == 0:
                return src[start:j + len(closer)]
        j += 1
    return None


def reading_time(words):
    return max(3, round(words / 210))


def build(a, tpl, i):
    slug, cat = a['slug'], a['category']
    art = a['article']
    words = sum(len(' '.join(s['paragraphs']).split()) for s in art['sections'])
    img = IMAGES[cat][i % len(IMAGES[cat])]
    url = f"https://zerolines.life/blog/{slug}.html"
    desc = art['meta_description'].strip()
    pub = a['publish']

    s = tpl

    # ---- head -------------------------------------------------------------
    s = re.sub(r'<title>[^<]*</title>', f'<title>{esc(a["title"])} — Zero Lines Journal</title>', s, 1)
    for attr, key in [('name', 'description'), ('property', 'og:description'), ('name', 'twitter:description')]:
        s = re.sub(rf'(<meta {attr}="{re.escape(key)}" content=")[^"]*(")', lambda m: m.group(1) + esc(desc) + m.group(2), s, 1)
    for attr, key in [('property', 'og:title'), ('name', 'twitter:title')]:
        s = re.sub(rf'(<meta {attr}="{re.escape(key)}" content=")[^"]*(")', lambda m: m.group(1) + esc(a['title']) + m.group(2), s, 1)
    s = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s, 1)
    s = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s, 1)
    s = re.sub(r'(<meta property="og:image" content="https://zerolines\.life/assets/og/)[^"]*(")',
               lambda m: m.group(1) + img + '.jpg' + m.group(2), s, 1)

    # ---- structured data --------------------------------------------------
    bp = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": a['title'], "description": desc,
        "image": f"https://zerolines.life/assets/{img}.webp",
        "author": {"@type": "Organization", "name": "Zero Lines"},
        "publisher": {"@type": "Organization", "name": "Zero Lines",
                      "logo": {"@type": "ImageObject", "url": "https://zerolines.life/assets/logo.png"}},
        "datePublished": pub, "dateModified": pub,
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
    }
    bc = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zerolines.life/"},
            {"@type": "ListItem", "position": 2, "name": "Journal", "item": "https://zerolines.life/blog/"},
            {"@type": "ListItem", "position": 3, "name": a['title'], "item": url},
        ],
    }
    blocks = list(re.finditer(r'<script[^>]*ld\+json[^>]*>([\s\S]*?)</script>', s))
    # 1 BlogPosting, 2 BreadcrumbList, 3 FAQPage (dropped), 4 Organization, 5 WebPage
    for m in reversed(blocks):
        try:
            t = json.loads(m.group(1)).get('@type')
        except Exception:
            continue
        if t == 'BlogPosting':
            s = s[:m.start(1)] + '\n  ' + json.dumps(bp, ensure_ascii=False) + '\n  ' + s[m.end(1):]
        elif t == 'BreadcrumbList':
            s = s[:m.start(1)] + '\n  ' + json.dumps(bc, ensure_ascii=False) + '\n  ' + s[m.end(1):]
        elif t == 'FAQPage':
            s = s[:m.start()] + s[m.end():]
        elif t == 'WebPage':
            s = s[:m.start(1)] + '\n  ' + json.dumps(
                {"@context": "https://schema.org", "@type": "WebPage", "@id": url,
                 "speakable": {"@type": "SpeakableSpecification",
                               "cssSelector": [".zl-blog-content > p:first-of-type", ".zl-blog-toc"]}},
                ensure_ascii=False) + '\n  ' + s[m.end(1):]

    # ---- hero -------------------------------------------------------------
    s = re.sub(r'<img src="/assets/[^"]+" alt="[^"]*" class="zl-blog-hero-image"',
               f'<img src="/assets/{img}.webp" alt="{esc(ALT[img])}" class="zl-blog-hero-image"', s, 1)
    s = re.sub(r'(<p class="zl-blog-eyebrow"[^>]*>)(?:<a[^>]*>)?[^<]+(?:</a>)?(</p>)',
               lambda m: m.group(1) + f'<a href="/blog/{CATEGORY_FILE[cat]}">{cat}</a>' + m.group(2), s, 1)
    s = re.sub(r'(<h1 class="zl-blog-hero-title"[^>]*>)[\s\S]*?(</h1>)',
               lambda m: m.group(1) + esc(a['title']) + m.group(2), s, 1)
    nice = datetime.date.fromisoformat(pub).strftime('%-d %B %Y')
    s = re.sub(r'<time datetime="[^"]*">[^<]*</time>',
               f'<time datetime="{pub}">Last updated: {nice}</time>', s, 1)
    s = re.sub(r'(</svg> )\d+ min read', lambda m: m.group(1) + f'{reading_time(words)} min read', s, 1)
    # breadcrumb trail
    s = re.sub(r'(<span aria-current="page">)[^<]*(</span>)',
               lambda m: m.group(1) + esc(a['title']) + m.group(2), s, 1)

    # ---- body -------------------------------------------------------------
    cta = block(s, 'zl-blog-ai-analyst', '<div', '</div>')
    body = [f'<div class="zl-blog-content">', f'      <p>{art["lede"].strip()}</p>', '']
    mid = len(art['sections']) // 2
    for n, sec in enumerate(art['sections']):
        body.append(f'<h2 data-reveal id="{sec["id"]}">{esc(sec["heading"])}</h2>')
        body.append('')
        for p in sec['paragraphs']:
            body.append(f'      <p>{p.strip()}</p>')
        body.append('')
        if n == mid and cta:
            body.append(cta)
            body.append('')
    if art.get('sources'):
        body.append('      <div class="zl-blog-sources" data-reveal="fade">')
        body.append('        <h3>Sources &amp; References</h3>')
        body.append('        <ul>')
        for src in art['sources']:
            body.append(f'          <li>{src.strip()}</li>')
        body.append('        </ul>')
        body.append('      </div>')
    body.append('    </div>')

    i0 = s.find('<div class="zl-blog-content">')
    i1 = s.find('<div class="zl-blog-related"')
    if i1 < 0:
        i1 = s.find('</article>')
    s = s[:i0] + '\n      '.join(body) + '\n\n    ' + s[i1:]
    return s


def main():
    written = json.load(io.open(sys.argv[1], encoding='utf-8'))
    tpl = io.open(TEMPLATE, encoding='utf-8').read()
    n = 0
    for i, a in enumerate(written):
        out = os.path.join(ROOT, 'blog', a['slug'] + '.html')
        io.open(out, 'w', encoding='utf-8').write(build(a, tpl, i))
        n += 1
        print(f"  {a['slug']:<38} {a['publish']}  {a['category']}")
    print(f"  {n} articles assembled")


if __name__ == '__main__':
    main()
