#!/usr/bin/env python3
"""Sort the flat assets/ folder into assets/img/{products,people,journal,pages}/,
archive anything no page references, rename the inline files to the blog- prefix,
rewrite every reference, and sort the source PNGs in assets/generated/ the same way.
Run from the repo root. Prints a summary; verify with the link check afterwards."""
import glob, io, os, re, subprocess, shutil
from collections import Counter

def cat(base):
    b = re.sub(r'-card$', '', base)
    if re.match(r'(product-|box-|refill-|group-|bright-protocol-|bright-.*-texture$)', b): return 'products'
    if re.match(r'(blog-)', b) or re.search(r'-inline-[12]$', b): return 'journal'
    if (re.match(r'(people-|hero-model-|model-|night-sleeping|hero-serum-application|hero-peeling-facial|'
                 r'home-hero-woman|home-analyser-portrait|formulations-hero-woman|formulations-editorial|bright-people)', b)
        or b.endswith('-hero-woman')): return 'people'
    return 'pages'

def newbase(base):
    # inline files were written without the blog- prefix; bring them into line
    m = re.match(r'^(?!blog-)(.+?)-inline-([12])(-card)?$', base)
    if m: return f'blog-{m.group(1)}-inline-{m.group(2)}{m.group(3) or ""}'
    return base

# what is referenced, anywhere that ships
refs = set()
SRC = [f for f in glob.glob('**/*.*', recursive=True)
       if f.endswith(('.html', '.css', '.js', '.xml', '.txt', '.json'))
       and not f.startswith(('cloudflare/public', 'node_modules', '.claude', 'assets/generated', 'assets/mockups'))]
for f in SRC:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    refs.update(os.path.basename(u) for u in re.findall(r'/assets/([^"\')\s>,]+\.webp)', s))

moves = {}   # old rel path -> new rel path
for f in sorted(glob.glob('assets/*.webp')):
    base = os.path.basename(f)[:-5]
    nb = newbase(base)
    used = (os.path.basename(f) in refs) or (base.endswith('-card') and (base[:-5] + '.webp') in refs)
    folder = f'assets/img/{cat(base)}' if used else 'assets/img/_archive'
    moves[f] = f'{folder}/{nb}.webp'

for d in {os.path.dirname(v) for v in moves.values()}: os.makedirs(d, exist_ok=True)
tracked = set(subprocess.run(['git', 'ls-files', 'assets'], capture_output=True, text=True).stdout.split())
for old, new in moves.items():
    if old in tracked: subprocess.run(['git', 'mv', '-f', old, new], check=True)
    else: shutil.move(old, new)

# rewrite references: /assets/<old>.webp -> /assets/img/<cat>/<new>.webp
rewrite = {os.path.basename(o): n.replace('assets/', '', 1) for o, n in moves.items()}   # 'x.webp' -> 'img/cat/y.webp'
pat = re.compile(r'/assets/([^"\')\s>,/]+\.webp)')
changed = 0; hits = 0
for f in SRC:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    def rep(m):
        global hits
        b = m.group(1)
        if b in rewrite: hits += 1; return '/assets/' + rewrite[b]
        return m.group(0)
    s2 = pat.sub(rep, s)
    if s2 != s: io.open(f, 'w', encoding='utf-8').write(s2); changed += 1

# the source PNGs, sorted the same way (loose ones only; already-sorted subfolders stay)
gen = 0
for f in sorted(glob.glob('assets/generated/*.png')):
    base = os.path.basename(f)[:-4]
    c = 'bright' if base.startswith('bright-') else cat(base)
    os.makedirs(f'assets/generated/{c}', exist_ok=True)
    dest = f'assets/generated/{c}/{newbase(base)}.png'
    if f in tracked: subprocess.run(['git', 'mv', '-f', f, dest], check=True)
    else: shutil.move(f, dest)
    gen += 1

by = Counter(os.path.dirname(v).split('/')[-1] for v in moves.values())
print(f"  moved {len(moves)} webp files → " + ', '.join(f"{k} {v}" for k, v in sorted(by.items())))
print(f"  rewrote {hits} references across {changed} files")
print(f"  sorted {gen} source PNGs into assets/generated/<category>/")
