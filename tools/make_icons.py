# -*- coding: utf-8 -*-
"""Builds the app icons from the STEM Cloud logo mark (public/static/brand/logo-mark.png).
Run: python tools/make_icons.py"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
MARK = Image.open(os.path.join(HERE, '..', 'public', 'static', 'brand', 'logo-mark.png')).convert('RGBA')
OUT = os.path.join(HERE, '..', 'public', 'static', 'icons')
S = 1024

def tile(rounded):
    top, bot = (250, 252, 255), (226, 236, 249)       # soft white-blue, matches the logo's own background
    img = Image.new('RGBA', (S, S))
    px = img.load()
    for y in range(S):
        t = y / S
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        for x in range(S):
            px[x, y] = c
    if rounded:
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(img, (0, 0), mask); return out
    return img

def save(name, size, width_frac, rounded, flat=False):
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0)) if flat else tile(rounded)
    w = int(S * width_frac); h = int(MARK.height * w / MARK.width)
    m = MARK.resize((w, h), Image.LANCZOS)
    base.alpha_composite(m, ((S - w) // 2, (S - h) // 2 + int(S * 0.01)))
    base.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
    print('wrote', name, size)

save('icon-192.png', 192, 0.74, True)
save('icon-512.png', 512, 0.74, True)
save('icon-maskable-512.png', 512, 0.58, False)     # full bleed; the mark stays inside the 80% safe zone
save('apple-touch-icon.png', 180, 0.66, False)      # iOS rounds the corners itself
save('favicon-32.png', 32, 1.0, False, flat=True)   # transparent, mark only
