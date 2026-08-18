#!/usr/bin/env python3
"""place-image.py <src.png> <asset-basename>
Writes assets/<base>.webp at native width and assets/<base>-card.webp at 820px.
The generator produces ~1376px, under the old 2560px heroes but well above what a
900px reading column ever displays. WebP q=82 via cwebp."""
import subprocess, sys, os
from PIL import Image
src, base = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); w, h = im.size
def write(img, path, q=82):
    tmp = path + '.tmp.png'; img.save(tmp, 'PNG')
    subprocess.run(['cwebp','-quiet','-q',str(q),tmp,'-o',path], check=True); os.remove(tmp)
    return os.path.getsize(path)
s1 = write(im, f'assets/{base}.webp')
cw = 820; ch = round(h*cw/w)
s2 = write(im.resize((cw,ch), Image.LANCZOS), f'assets/{base}-card.webp')
print(f"  {base:44s} {w}x{h} {s1//1024:4d}KB | card {s2//1024:3d}KB")
