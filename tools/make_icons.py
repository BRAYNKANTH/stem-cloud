# -*- coding: utf-8 -*-
"""Builds the app icons from the STEM Cloud logo mark (public/static/brand/logo-mark.png).
Run: python tools/make_icons.py"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MARK = Image.open(os.path.join(HERE, '..', 'public', 'static', 'brand', 'logo-mark.png')).convert('RGBA')
OUT = os.path.join(HERE, '..', 'public', 'static', 'icons')
S = 1024
LOGIN_BG = (241, 246, 252, 255)  # Matches login screen background #f1f6fc


def save(name, size, width_frac, bg_color=None):
    if bg_color is None:
        base = Image.new('RGBA', (S, S), (0, 0, 0, 0))  # Transparent, exact logo mark as on login screen
    else:
        base = Image.new('RGBA', (S, S), bg_color)
    w = int(S * width_frac)
    h = int(MARK.height * w / MARK.width)
    m = MARK.resize((w, h), Image.LANCZOS)
    base.alpha_composite(m, ((S - w) // 2, (S - h) // 2))
    base.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
    print(f"wrote {name} {size}x{size}")


# PWA icons: transparent background, exact same cut-out cloud logo mark as on login screen
save('icon-192.png', 192, 0.95, bg_color=None)
save('icon-512.png', 512, 0.95, bg_color=None)

# Maskable Android icon: solid login screen background (#f1f6fc) with mark inside safe zone (70%)
save('icon-maskable-512.png', 512, 0.70, bg_color=LOGIN_BG)

# Apple Touch Icon: solid login screen background (#f1f6fc) for iOS home screen
save('apple-touch-icon.png', 180, 0.85, bg_color=LOGIN_BG)

# Favicons for browsers
save('favicon-32.png', 32, 1.0, bg_color=None)

# Multi-resolution favicon.ico (16x16, 32x32, 48x48)
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_imgs = []
for sz in ico_sizes:
    b = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    w = S
    h = int(MARK.height * w / MARK.width)
    m = MARK.resize((w, h), Image.LANCZOS)
    b.alpha_composite(m, (0, (S - h) // 2))
    ico_imgs.append(b.resize(sz, Image.LANCZOS))

ico_path = os.path.join(OUT, 'favicon.ico')
ico_imgs[1].save(ico_path, format='ICO', sizes=ico_sizes)
print("wrote favicon.ico (16, 32, 48)")
