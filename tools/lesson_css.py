# -*- coding: utf-8 -*-
"""Port the styles of the lesson content (notes, worked examples, answers, activities) to the new lesson pages.

The rich text in content/ keeps the class names of the hand-built lesson pages (.exq, .work, .formula-box, .callout, ...),
and the story and quiz islands use the old pages' own class names (.so-*, .qz-*, the answer sheet #stem-qsheet), so they
look as they do today. Their styles live in each page's own <style> block, with small differences between chapters,
plus the bright theme, the player's fixes and the app layer in public/static/. This collects every rule whose selectors
only name those classes, from all lesson pages (the first copy of a rule wins, exact duplicates are dropped), then the
public/static/ rules for the same classes (with their dark-theme versions), scopes them all under .lc (the lesson on the
new pages) and writes web/src/styles/lesson-content.css, with the story's and the sheet's animations. The old page variables (--text, --panel, ...) are mapped to the design tokens there; font families,
the old theme and language rules are left out (the new pages set type from the design tokens).

    python tools/lesson_css.py           # write the file
    python tools/lesson_css.py --check   # fail if the file is not current (the old pages changed)
"""
import glob, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'web' / 'src' / 'styles' / 'lesson-content.css'
PAGES = sorted(glob.glob(str(ROOT / 'site' / 'lessons' / '*.html')))
LATER = [ROOT / 'public' / 'static' / n for n in ('theme-bright.css', 'player.css', 'app-layer.css')]
ISLAND_PREFIXES = ('so-', 'qz-', 'qs-')       # story (StoryPlayer) and quiz (Quiz, the answer sheet)
ISLAND_IDS = {'stem-qsheet', 'stem-vp'}       # the quiz's answer sheet, the read-aloud controls
# the quiz score line, exercise parts in rows, full-screen diagrams, read-aloud and the voice messages (questions.js, voice.js)
ISLAND_CLASSES = {'quiz-score', 'qpart', 'qlead', 'ql', 'qt', 'has-parts', 'qd-cap', 'fig-hint', 'zoomable', 'pannable',
                  'stem-lightbox', 'lb-bar', 'lb-body', 'stem-toast', 'stem-reading', 'vp-pos',
                  # the labs (web/src/labs/): the lesson pages' lab card, guide, stage and missions, controls, readouts and graphs
                  'lab-card', 'lg', 'goal', 'look', 'lg-tries', 'lg-try', 'lg-see', 'lg-live', 'ls', 'ls-top', 'ls-hint', 'ls-miss', 'ls-m', 'ck',
                  'lab-controls', 'control', 'lab-buttons', 'lab-readouts', 'readout', 'ro-label', 'ro-value', 'track-wrap', 'graphs-row',
                  'graph-box', 'gtitle', 'lab-hint', 'lab-svg'}
STATES = {'correct', 'wrong', 'show', 'on', 'talking', 'now', 'done', 'r', 'c', 'ok', 'no', 'quiet'}   # the islands' state classes, next to one of theirs
DARK = re.compile(r'^(?:html|:root)?\[data-theme="?dark"?\]\s+')


def content_classes():
    """Every class name used in the rich text of content/."""
    out = set()
    for f in glob.glob(str(ROOT / 'content' / '*' / '*' / '*' / 'lesson.json')):
        for m in re.findall(r'class=\\"([^"\\]+)\\"', Path(f).read_text(encoding='utf8')):
            out.update(m.split())
    return out


def keyframes(css):
    """name -> the whole @keyframes block."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out = {}
    for m in re.finditer(r'@keyframes\s+([A-Za-z0-9_-]+)\s*\{', css):
        depth, j = 0, m.end() - 1
        for j in range(m.end() - 1, len(css)):
            depth += {'{': 1, '}': -1}.get(css[j], 0)
            if depth == 0:
                break
        out.setdefault(m.group(1), re.sub(r'\s+', ' ', css[m.start():j + 1]))
    return out


def rules(css):
    """(media, selector, body) for every rule; one level of @media is kept, other at-rules are skipped."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, n = [], 0, len(css)

    def block(start):                     # index after the matching close brace
        depth = 0
        for j in range(start, n):
            if css[j] == '{':
                depth += 1
            elif css[j] == '}':
                depth -= 1
                if depth == 0:
                    return j + 1
        return n

    while i < n:
        k = css.find('{', i)
        if k < 0:
            break
        head = css[i:k].strip()
        end = block(k)
        if head.startswith('@media'):
            inner = css[k + 1:end - 1]
            out += [(head, s, b) for _, s, b in rules(inner)]
        elif not head.startswith('@'):
            out.append(('', head, css[k + 1:end - 1].strip()))
        i = end
    return out


TOKEN = re.compile(r'\.([a-zA-Z0-9_-]+)')


def ok_class(c, allowed):
    return c in allowed or c in ISLAND_CLASSES or c.startswith(ISLAND_PREFIXES)


def keep(sel, allowed, dark_ok=False):
    """The selector scoped under .lc, or None if it names anything but these classes (other ids, page parts, html/body).
    dark_ok: a dark-theme rule from public/static/ keeps its [data-theme="dark"] in front."""
    s, dark = sel.strip(), ''
    m = DARK.match(s)
    if m and dark_ok:
        s, dark = s[m.end():], ':root[data-theme="dark"] '
    if not s or re.search(r'html|body|:root|lang-|data-theme', s):      # theme and language rules: the new pages have their own
        return None
    ids = re.findall(r'#([A-Za-z0-9_-]+)', s)
    if any(i not in ISLAND_IDS for i in ids):
        return None
    names = TOKEN.findall(re.sub(r'#[A-Za-z0-9_-]+', '', s))
    island = bool(ids) or any(c.startswith(ISLAND_PREFIXES) or c in ISLAND_CLASSES for c in names)
    if (not names and not ids) or any(not (ok_class(c, allowed) or (island and c in STATES)) for c in names):
        return None
    return dark + '.lc ' + s


def collect():
    allowed = content_classes()
    seen, out = set(), []
    pages = [''.join(re.findall(r'<style[^>]*>(.*?)</style>', Path(p).read_text(encoding='utf8'), re.S)) for p in PAGES]
    sources = [(css, False) for css in pages] + [(p.read_text(encoding='utf8'), True) for p in LATER]
    frames = {}
    for css, later in sources:
        for name, block in keyframes(css).items():
            if name.startswith(ISLAND_PREFIXES):
                frames.setdefault(name, block)
        for media, sel, body in rules(css):
            if 'prefers-color-scheme' in media:     # the old pages followed the system theme; the new ones follow the student's choice
                continue
            sels = [keep(x, allowed, dark_ok=later) for x in sel.split(',')]
            sels = [x for x in sels if x]
            if not sels or not body:
                continue
            body = re.sub(r'\s+', ' ', body).strip().rstrip(';')
            body = ';'.join(d for d in body.split(';') if d.strip() and not d.strip().startswith('font-family'))      # type comes from the design tokens
            key = (media, ','.join(sels), body)
            if key in seen:
                continue
            seen.add(key)
            out.append(key)
    return out, frames


HEAD = '''/* Generated by tools/lesson_css.py from the lesson pages' own styles, public/static/theme-bright.css,
   public/static/player.css and public/static/app-layer.css. Do not edit: change the generator or the old pages, then run it again.
   Scoped to .lc, the lesson content on the new pages. The old page variables are mapped to the design tokens. */
.lc {
  --bg: var(--sc-ground); --bg-alt: var(--sc-panel-2); --panel: var(--sc-panel); --panel-2: var(--sc-panel-2); --border: var(--sc-line);
  --text: var(--sc-ink); --text-dim: var(--sc-ink-2); --text-faint: var(--sc-faint);
  --accent: var(--sc-blue); --accent-2: var(--sc-blue); --accent-3: var(--sc-raja); --on-accent: var(--sc-cta-ink); --accent-text: var(--sc-blue);
  --good: var(--sc-leaf); --good-bg: var(--sc-leaf-lt); --danger: var(--sc-clay); --danger-bg: var(--sc-clay-lt);
  --warn-bg: var(--sc-mango-lt); --warn-border: var(--sc-mango);
  --raja: var(--sc-raja); --chittu: var(--sc-chittu);
  --shadow: 0 3px 0 var(--sc-line); --radius: var(--r-lg);
}
'''


def render():
    found, frames = collect()
    lines, media = [HEAD], None
    for m, sel, body in found:
        if m != media:
            if media:
                lines.append('}')
            if m:
                lines.append(m + ' {')
            media = m
        lines.append(('  ' if m else '') + sel + ' { ' + body + ' }')
    if media:
        lines.append('}')
    lines += [frames[k] for k in sorted(frames)]
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    css = render()
    if '--check' in sys.argv:
        if not OUT.is_file() or OUT.read_text(encoding='utf8').replace('\r\n', '\n') != css:      # a Windows checkout may have CRLF
            sys.exit('web/src/styles/lesson-content.css is not current: run python tools/lesson_css.py')
        print('lesson-content.css is current')
    else:
        OUT.write_text(css, encoding='utf8', newline='\n')
        print('wrote %s (%d rules, %.1f KB)' % (OUT.relative_to(ROOT), css.count('{') - 1, len(css.encode()) / 1024))
