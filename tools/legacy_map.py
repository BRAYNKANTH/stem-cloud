# -*- coding: utf-8 -*-
"""Write stemcloud/legacy_map.json: what the server needs to turn progress saved by the current lesson pages (v1 keys)
into progress v2 rows (stemcloud/progress_bridge.py). Built from content/: for each lesson page's id (u2, c5, ...)
the lesson id, its section id -> step id map, its game step and the key its game keeps stars under, and its topics;
and for the cut-over (stemcloud/cutover.py), the page's file and the address of its new lesson page.
The content folder is not bundled with the server, so this small file is.

    python tools/legacy_map.py           # write it
    python tools/legacy_map.py --check   # fail if it is not current (CI)
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'stemcloud' / 'legacy_map.json'


def build() -> dict:
    out = {}
    for f in sorted((ROOT / 'content').glob('*/*/*/lesson.json')):
        l = json.loads(f.read_text(encoding='utf-8'))
        leg = l.get('legacy')
        if not leg:
            continue
        games = [s['id'] for s in l['steps'] if s['type'] == 'game']
        out[leg['id']] = {
            'lesson': l['id'],
            'steps': leg.get('steps', {}),
            'game': games[0] if len(games) == 1 else None,
            'stars_key': leg.get('stars_key'),
            'topics': [t['id'] for t in l.get('topics', [])],
            'file': leg['file'],
            'url': '/learn/%s/g%d/%s/' % (l['subject'], l['grade'], l['slug']),
        }
    return out


def render() -> str:
    return json.dumps(build(), ensure_ascii=False, indent=1, sort_keys=True) + '\n'


if __name__ == '__main__':
    text = render()
    if '--check' in sys.argv:
        if not OUT.is_file() or OUT.read_text(encoding='utf-8').replace('\r\n', '\n') != text:
            sys.exit('stemcloud/legacy_map.json is not current: run python tools/legacy_map.py')
        print('legacy_map.json is current')
    else:
        OUT.write_text(text, encoding='utf-8', newline='\n')
        print('wrote %s (%d lesson pages)' % (OUT.relative_to(ROOT).as_posix(), len(json.loads(text))))
