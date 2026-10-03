# -*- coding: utf-8 -*-
"""Draws the STEM Cloud app icons (cloud + atom on a teal-to-violet tile). Run: python tools/make_icons.py"""
import math, os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'static', 'icons')
S = 1024

def gradient(size):
    a, b = (14, 165, 140), (106, 85, 232)           # teal -> violet
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.35 + y * 0.65) / size
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img

def art(scale):
    """transparent layer: white cloud with an atom inside; scale<1 shrinks it into the maskable safe zone"""
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    cx, cy = S / 2, S / 2 + 20
    def sc(v): return v * scale
    # cloud
    for ox, oy, r in [(-190, 40, 150), (0, -60, 215), (200, 30, 160), (-40, 90, 190), (70, 80, 190)]:
        x, y, rr = cx + sc(ox), cy + sc(oy), sc(r)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, 255))
    d.rounded_rectangle([cx - sc(335), cy + sc(30), cx + sc(355), cy + sc(255)], radius=sc(110), fill=(255, 255, 255, 255))
    # atom
    A = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ad = ImageDraw.Draw(A)
    ax, ay = cx, cy + sc(20)
    for ang, col in [(0, (14, 165, 140, 255)), (60, (106, 85, 232, 255)), (120, (14, 165, 140, 255))]:
        orb = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        od = ImageDraw.Draw(orb)
        rx, ry = sc(235), sc(88)
        od.ellipse([ax - rx, ay - ry, ax + rx, ay + ry], outline=col, width=int(sc(26)))
        A.alpha_composite(orb.rotate(ang, center=(ax, ay), resample=Image.BICUBIC))
    nr = sc(48)
    ad = ImageDraw.Draw(A)
    ad.ellipse([ax - nr, ay - nr, ax + nr, ay + nr], fill=(255, 159, 64, 255))
    L.alpha_composite(A)
    return L

def save(name, size, scale, bleed):
    base = gradient(S).convert('RGBA')
    if not bleed:                                   # rounded tile for "any" icons
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        tile = Image.new('RGBA', (S, S), (0, 0, 0, 0)); tile.paste(base, (0, 0), mask); base = tile
    base.alpha_composite(art(scale))
    base.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
    print('wrote', name, size)

save('icon-192.png', 192, 1.2, False)
save('icon-512.png', 512, 1.2, False)
save('icon-maskable-512.png', 512, 0.95, True)      # full bleed, art inside the 80% safe zone
save('apple-touch-icon.png', 180, 1.1, True)       # iOS rounds the corners itself
save('favicon-32.png', 32, 1.25, False)
