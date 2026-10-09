# -*- coding: utf-8 -*-
"""Writes public/static/ui-generated.css: overrides for the parts of the existing styles that conflict with the interface rules.

    python tools/build_ui_overrides.py        (needs: pip install tinycss2)

The lesson pages are generated elsewhere and carry their own <style> blocks, so the interface layer (public/static/ui.css) cannot edit them.
Instead this tool reads every stylesheet the app serves (the app's CSS files, the <style> blocks of the lesson pages, the contents page and the
static pages) and, for each rule that
  * fills a background with a gradient             -> a flat fill (the accent for buttons, a plain panel for tinted boxes),
  * rounds a corner more than 8px or makes a pill  -> the app's small radius scale (circles and dots are left alone),
  * draws a thick coloured stripe on the left edge -> a plain 1px border,
writes a rule with the same selector and !important. Re-run it after tools/sync_lessons.py so new lesson styles are covered.
"""
import glob, os, re, sys
import tinycss2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'static', 'ui-generated.css')
SKIP_CSS = {'ui.css', 'ui-generated.css', 'topics.css'}          # topics.css already follows the rules


def sources():
    for p in sorted(glob.glob(os.path.join(ROOT, 'public', 'static', '*.css'))):
        if os.path.basename(p) not in SKIP_CSS:
            yield p, open(p, encoding='utf-8').read()
    pats = [os.path.join(ROOT, 'site', 'lessons', '*.html'), os.path.join(ROOT, 'public', 'static', '*.html')]
    for pat in pats:
        for p in sorted(glob.glob(pat)):
            html = open(p, encoding='utf-8').read()
            for m in re.finditer(r'<style[^>]*>(.*?)</style>', html, re.S):
                yield p, m.group(1)


def rules(nodes):
    for n in nodes:
        if n.type == 'qualified-rule':
            yield n
        elif n.type == 'at-rule' and n.content is not None and n.lower_at_keyword in ('media', 'supports', 'layer'):
            yield from rules(tinycss2.parse_rule_list(n.content, skip_whitespace=True, skip_comments=True))


def decls(rule):
    out = {}
    for d in tinycss2.parse_declaration_list(rule.content, skip_whitespace=True, skip_comments=True):
        if d.type == 'declaration':
            out[d.lower_name] = tinycss2.serialize(d.value).strip()
    return out


BUTTON_GRADIENT = re.compile(r'(var\(--accent\)\s*,\s*var\(--accent-2\)|var\(--acc\)\s*,\s*var\(--acc2\)|#6366f1|#8b5cf6|var\(--accent,[^)]*\)\s*,\s*var\(--accent-2)', re.I)


def gradient_fill(d):
    v = d.get('background') or d.get('background-image') or ''
    if 'gradient(' not in v:
        return None
    if re.match(r'\s*linear-gradient\(\s*(?:\d+deg|to [a-z ]+)?\s*,?\s*transparent', v) or '-mask' in v:
        return None                                                  # a fade-out scrim, not a fill
    if BUTTON_GRADIENT.search(v) and 'color-mix' not in v.split(',')[1] if ',' in v else False:
        return 'var(--accent)'
    return 'var(--panel-2)'


def map_radius(px):
    if px >= 90:
        return 'var(--r-sm)'          # pills become small tags
    if px >= 15:
        return 'var(--r-lg)'
    if px >= 9:
        return 'var(--r)'
    return None


def radius_override(d):
    v = d.get('border-radius')
    if not v or '%' in v or 'var(' in v:
        return None
    toks = re.findall(r'(-?\d*\.?\d+)px', v)
    if not toks:
        return None
    w, h = re.match(r'(\d+)px', d.get('width', '') or ''), re.match(r'(\d+)px', d.get('height', '') or '')
    if w and h and w.group(1) == h.group(1) and max(float(t) for t in toks) >= int(w.group(1)) / 2.2:
        return None                                                  # a circle (avatar, dot, round button)
    if all(float(t) >= 90 for t in toks) and (w and int(w.group(1)) <= 16):
        return None                                                  # a dot or a bar end
    new = re.sub(r'(-?\d*\.?\d+)px', lambda m: map_radius(float(m.group(1))) or m.group(0), v)
    return new if new != v else None


def main():
    lines = set()
    for _, css in sources():
        try:
            nodes = tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True)
        except Exception:
            continue
        for r in rules(nodes):
            sel = tinycss2.serialize(r.prelude).strip()
            if not sel or sel.startswith('@') or 'keyframes' in sel:
                continue
            d = decls(r)
            body = []
            g = gradient_fill(d)
            if g:
                body.append('background:%s!important' % g)
                if g == 'var(--accent)' and d.get('color', '').lower() in ('#fff', '#ffffff', 'white'):
                    body.append('color:var(--on-accent)!important')
            rr = radius_override(d)
            if rr:
                body.append('border-radius:%s!important' % rr)
            bl = d.get('border-left', '')
            triangle = re.search(r'::?(before|after)', sel) or d.get('width') in ('0', '0px') or 'transparent' in ' '.join(v for k, v in d.items() if k.startswith('border'))
            if re.match(r'([3-9]|\d\d)px\s+solid', bl) and not triangle:      # (border triangles such as speech-bubble tails are not stripes)
                body.append('border-left:1px solid var(--border)!important')
            if body:
                lines.add('%s{%s}' % (re.sub(r'\s+', ' ', sel), ';'.join(body)))
    out = ['/* GENERATED by tools/build_ui_overrides.py: do not edit by hand. Flat fills, small radii and no left stripes for the existing styles. */']
    out += sorted(lines)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    print('wrote', os.path.relpath(OUT, ROOT), '(%d rules, %d bytes)' % (len(lines), os.path.getsize(OUT)))


if __name__ == '__main__':
    sys.exit(main())
