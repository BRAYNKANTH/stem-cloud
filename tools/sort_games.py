# -*- coding: utf-8 -*-
"""Lift the lesson pages' sort games ("match + sort") into data for the new lesson pages: web/src/games/sort/.

Every lesson page has the same two-round game: match each term to its meaning, then sort the chips into the bins (two or three). The
code is the same; the pages differ only in how they write the data (a JSON object, or JS arrays). So this takes, from
each page: the terms (en, ta, meaning), the chips and their bins, the round titles and hints, the column and bin
titles, and what finishing gives (the page's sortGameComplete: its XP and badge). The data literals are read by node
(they are plain JS values). The game itself is games/SortGame.tsx.

    <lesson slug>.json          one game's data
    index.ts                    the games by lesson (components/lesson/Step.astro, at build time only)

    python tools/sort_games.py           # write them
    python tools/sort_games.py --check   # fail if they are not current (the lesson pages changed)
"""
import glob, html, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'web' / 'src' / 'games' / 'sort'


def scripts(s):
    return ''.join(re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', s, re.S))


def literal(js, start):
    """The JS value literal starting at js[start] ('[' or '{'), up to its matching bracket (strings skipped)."""
    depth, i, q = 0, start, None
    while i < len(js):
        c = js[i]
        if q:
            if c == '\\':
                i += 1
            elif c == q:
                q = None
        elif c in '"\'`':
            q = c
        elif c in '[{':
            depth += 1
        elif c in ']}':
            depth -= 1
            if depth == 0:
                return js[start:i + 1]
        i += 1
    raise ValueError('unclosed literal')


def evaluate(src):
    out = subprocess.run(['node', '-e', 'process.stdout.write(JSON.stringify(eval("(" + require("fs").readFileSync(0, "utf8") + ")")))'],
                         input=src, capture_output=True, text=True, encoding='utf-8', check=True).stdout
    return json.loads(out)


def text(el_html):
    """[en, ta] of an element written as <tag ... data-ta="ta">en</tag>."""
    m = re.search(r'data-ta="([^"]*)"[^>]*>(.*?)</', el_html, re.S)
    return [m.group(2).strip(), html.unescape(m.group(1))]


def game(path):
    s = Path(path).read_text(encoding='utf-8')
    sc = scripts(s)
    a = s.index('<section class="block" id="sortgame">')
    sec = s[a:s.index('</section>', a)]
    i = re.search(r'\n   [A-Z0-9 +]*SORT GAME\n', sc).end()
    body = sc[i:sc.index('\n})();', i)]
    if 'const S = ' in body:
        S = evaluate(literal(body, body.index('const S = ') + len('const S = ')))
        terms, items = S['terms'], S['items']
        bins = [(b, 'bin_' + b) for b in S['bins']]
    else:
        terms = evaluate(literal(body, body.index('const terms = ') + len('const terms = ')))
        items = evaluate(literal(body, body.index('const sortItems = ') + len('const sortItems = ')))
        bins = [(k, el) for el, k in re.findall(r"getElementById\('(\w+)'\)\.addEventListener\('click', \(\)=>tryPlace\('(\w+)'", body)]
    out_bins = []
    for key, el in bins:
        m = re.search(r'<div class="sort-bin" id="%s">\s*(<div class="btitle".*?</div>)' % el, sec, re.S)
        out_bins.append({'id': key, 'title': text(m.group(1))})
    h3 = re.findall(r'<h3[^>]*data-ta="[^"]*"[^>]*>.*?</h3>', sec, re.S)
    ps = re.findall(r'<p[^>]*data-ta="[^"]*"[^>]*>.*?</p>', sec, re.S)
    cols = re.findall(r'<div class="mtitle"[^>]*>.*?</div>', sec, re.S)
    if len(h3) != 2 or len(ps) != 2 or len(cols) != 2 or len(out_bins) < 2:
        sys.exit('%s: the sort game markup changed; update tools/sort_games.py' % path)
    done = re.search(r"function sortGameComplete\(\)\{\s*addXP\((\d+), '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'\);\s*awardBadge\((PFX\s*\+\s*)?'([^']+)'\);", sc)
    if not done:
        sys.exit('%s: no sortGameComplete found; update tools/sort_games.py' % path)
    pfx = re.search(r"const PFX = '([^']*)';", sc)
    if done.group(4) and not pfx:
        sys.exit('%s: the badge uses PFX, which is not defined' % path)
    badge = (pfx.group(1) if done.group(4) else '') + done.group(5)
    for it in items:
        if it['bin'] not in {b['id'] for b in out_bins}:
            sys.exit('%s: chip %s goes to an unknown bin' % (path, it['id']))
    return {
        'rounds': [{'title': text(h3[0]), 'hint': text(ps[0])}, {'title': text(h3[1]), 'hint': text(ps[1])}],
        'columns': [text(cols[0]), text(cols[1])],
        'terms': [{'id': t['id'], 'term': [t['en'], t['ta']], 'meaning': [t['defEn'], t['defTa']]} for t in terms],
        'items': [{'id': it['id'], 'text': [it['en'], it['ta']], 'bin': it['bin']} for it in items],
        'bins': out_bins,
        'complete': {'xp': int(done.group(1)), 'message': [done.group(2).replace("\\'", "'"), done.group(3).replace("\\'", "'")], 'badge': badge},
    }


def render():
    lessons = {}
    for f in glob.glob(str(ROOT / 'content' / '*' / '*' / '*' / 'lesson.json')):
        L = json.loads(Path(f).read_text(encoding='utf-8'))
        if L.get('legacy') and any(st['type'] == 'sort' for st in L['steps']):
            lessons[L['legacy']['file']] = L
    files, index = {}, []
    for name, L in sorted(lessons.items(), key=lambda x: x[1]['id']):
        g = game(ROOT / 'site' / 'lessons' / name)
        files[L['slug'] + '.json'] = json.dumps(g, ensure_ascii=False, indent=1) + '\n'
        index.append((L['id'], L['slug']))
    files['index.ts'] = ('// Generated by tools/sort_games.py from the lesson pages: their sort games, by lesson. Used at build time only\n'
        '// (components/lesson/Step.astro gives a page its own game as props).\n'
        "import type { SortGameData } from '../SortGame';\n"
        + ''.join("import g%d from './%s.json';\n" % (i, s) for i, (_, s) in enumerate(index))
        + '\nexport const SORT_GAMES: Record<string, SortGameData> = {\n'
        + ''.join("  '%s': g%d as SortGameData,\n" % (lid, i) for i, (lid, _) in enumerate(index)) + '};\n')
    return files


if __name__ == '__main__':
    files = render()
    if '--check' in sys.argv:
        stale = [n for n, t in files.items() if not (OUT / n).is_file() or (OUT / n).read_text(encoding='utf-8').replace('\r\n', '\n') != t]
        extra = [p.name for p in OUT.glob('*') if p.name not in files] if OUT.is_dir() else []
        if stale or extra:
            sys.exit('web/src/games/sort/ is not current (%s): run python tools/sort_games.py' % ', '.join(stale + extra))
        print('the sort games are current (%d files)' % len(files))
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for n, t in files.items():
            (OUT / n).write_text(t, encoding='utf-8', newline='\n')
        print('wrote %d files in %s' % (len(files), OUT.relative_to(ROOT).as_posix()))
