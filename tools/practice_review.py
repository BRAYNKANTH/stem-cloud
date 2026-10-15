# -*- coding: utf-8 -*-
"""A review sheet of a chapter's practice questions for a teacher: every question in English and Tamil, its options
with the right one marked, and the reason. Written to docs/review/<chapter>.md.

    python tools/practice_review.py hydrostatic-pressure
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main(slug: str):
    path = next(ROOT.glob('content/practice/*/%s.json' % slug), None)
    if not path:
        sys.exit('no practice questions for %s' % slug)
    data = json.loads(path.read_text(encoding='utf-8'))
    out = ['# Practice questions for review: %s' % slug, '',
           'For a teacher: check each question, its right answer (✅) and the reason, in English and Tamil. '
           'Write corrections next to the question number (for example "hp-022: option 3 should be…").', '',
           '%d questions · status: %s' % (len(data['questions']), data.get('status', '')), '']
    topic = None
    for q in data['questions']:
        if q['topic'] != topic:
            topic = q['topic']
            out += ['## %s' % topic.capitalize(), '']
        tag = 'true / false' if q['type'] == 'tf' else 'multiple choice'
        pic = ' · picture: %s' % q['figure']['kind'] if q.get('figure') else ''
        out += ['### %s · %s · %s%s' % (q['id'], tag, q['level'], pic), '', '**EN:** ' + q['q']['en'], '', '**TA:** ' + q['q']['ta'], '']
        if q['type'] == 'tf':
            out += ['Answer: ✅ %s' % ('True / சரி' if q['correct'] == 1 else 'False / பிழை'), '']
        else:
            for k, o in enumerate(q['options']):
                out.append('%d. %s%s · %s' % (k + 1, '✅ ' if k == q['correct'] else '', o['en'], o['ta']))
            out.append('')
        out += ['Why: %s' % q['why']['en'], '', 'ஏன்: %s' % q['why']['ta'], '']
        if q.get('calc'):
            out += ['Worked: `%s`' % q['calc'], '']
    dest = ROOT / 'docs' / 'review' / ('%s.md' % slug)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text('\n'.join(out), encoding='utf-8', newline='\n')
    print('wrote', dest.relative_to(ROOT).as_posix())


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'hydrostatic-pressure')
