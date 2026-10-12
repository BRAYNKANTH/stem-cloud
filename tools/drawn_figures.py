# -*- coding: utf-8 -*-
"""Capture the drawings that a lesson page's own script draws when it loads, for the lesson content.

A few worked examples have a graph that is not in the page's HTML: the page has an empty <svg id="q1Svg"> and its script
draws into it (drawAxisLineGraph in unit 2, drawRodDiagram in chapter 11). The extractor would carry over the empty
drawing. This opens each lesson page in a real browser (Playwright, the system Edge or Chrome), takes every such drawing
once it is drawn, turns the colours the script read from the page's theme back into the theme variables (so they follow
light and dark on the new pages), and writes tools/drawn_figures.json. tools/extract_lesson.py fills the empty drawings
from it, so CI never needs a browser. Run it again when a lesson page changes one of these drawings.

    python tools/drawn_figures.py
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / 'site' / 'lessons'
CONTENT = ROOT / 'content'
OUT = ROOT / 'tools' / 'drawn_figures.json'
EMPTY_SVG = re.compile(r'<svg\b[^>]*\bid="([A-Za-z0-9_-]+)"[^>]*>\s*</svg>')
VARS = ['--text', '--text-dim', '--text-faint', '--accent', '--accent-2', '--accent-3', '--border', '--panel', '--panel-2', '--good', '--danger']

# In the page: every empty drawing that the script filled, with colours that match a theme variable written as var(...).
TAKE = '''([ids, vars]) => {
  const css = getComputedStyle(document.documentElement), back = {};
  for (const v of vars) { const x = css.getPropertyValue(v).trim().toLowerCase(); if (x && !(x in back)) back[x] = v; }
  const out = {};
  for (const id of ids) {
    const svg = document.getElementById(id);
    if (!svg || !svg.children.length) continue;
    const copy = svg.cloneNode(true);
    for (const el of copy.querySelectorAll('*')) {
      const style = [];
      for (const a of ['fill', 'stroke']) {
        const val = (el.getAttribute(a) || '').trim().toLowerCase();
        if (val in back) { el.removeAttribute(a); style.push(a + ':var(' + back[val] + ')'); }
      }
      if (style.length) el.setAttribute('style', style.join(';'));
    }
    out[id] = copy.innerHTML;
  }
  return out;
}'''


def strings(node):
    if isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)
    elif isinstance(node, str):
        yield node


def main():
    from playwright.sync_api import sync_playwright
    # only drawings that are empty in the extracted lessons (labs and animations draw too, but they are not lesson content)
    wanted = {}
    for f in sorted(CONTENT.glob('*/*/*/lesson.json')):
        lesson = json.loads(f.read_text(encoding='utf-8'))
        found = set()
        for text in strings(lesson['steps']):
            found.update(EMPTY_SVG.findall(text))
        if found and lesson.get('legacy'):
            wanted[lesson['legacy']['file']] = sorted(found)
    out = {}
    with sync_playwright() as p:
        browser = None
        for channel in ('msedge', 'chrome', None):
            try:
                browser = p.chromium.launch(channel=channel) if channel else p.chromium.launch()
                break
            except Exception:
                continue
        if browser is None:
            sys.exit('No browser found: install Edge or Chrome, or run: python -m playwright install chromium')
        tab = browser.new_page(viewport={'width': 1280, 'height': 900})
        tab.route(re.compile(r'^https?://'), lambda r: r.abort())      # fonts and app scripts: not needed to draw, and offline-safe
        tab.add_init_script("try{localStorage.setItem('lessonLang','en');localStorage.setItem('lessonTheme','light')}catch(e){}")
        for name, ids in wanted.items():
            tab.goto((PAGES / name).as_uri(), wait_until='domcontentloaded', timeout=30000)         # the page's own script draws; app scripts from /static/ are not needed
            tab.wait_for_timeout(500)
            got = tab.evaluate(TAKE, [ids, VARS])
            missing = [i for i in ids if i not in got]
            if missing:
                print('%s: not drawn by the page: %s' % (name, ', '.join(missing)))
            if got:
                out[name] = got
            print('%s: %d drawing(s)' % (name, len(got)))
        browser.close()
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8', newline='\n')
    print('wrote %s' % OUT.relative_to(ROOT).as_posix())


if __name__ == '__main__':
    main()
