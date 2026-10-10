# -*- coding: utf-8 -*-
"""Builds the topic-by-topic view of a chapter from the existing lesson page.

    python tools/build_topics.py                       # every spec in tools/topics/
    python tools/build_topics.py unit-02-motion-in-a-straight-line

For each tools/topics/<slug>.spec.json this reads site/lessons/<lessonFile> (notes cards, textbook exercises, self-check quiz,
summary) and writes site/lessons/topics/<slug>.json, which the topic pages (public/static/topics.js) render. Nothing in the lesson
page is changed or removed. Re-run it after `tools/sync_lessons.py` so the topic view follows lesson updates.
It also prints the content that is still missing for each topic, so the content team can see what needs to be supplied.
"""
import copy, glob, json, os, re, sys
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS = os.path.join(ROOT, 'tools', 'topics')
LESSONS = os.path.join(ROOT, 'site', 'lessons')
OUT = os.path.join(LESSONS, 'topics')
STEPS = ('understand', 'watch', 'explore', 'practice')


def inner(el):
    return ''.join(str(c) for c in el.contents).strip()


def strip_attrs(el, keep=('data-ta', 'class', 'colspan', 'rowspan', 'href')):
    for t in [el] + el.find_all(True):
        for a in list(t.attrs):
            if a not in keep:
                del t.attrs[a]


def clean_fragment(el):
    """A copy of a lesson fragment without ids, inline handlers, buttons or scripts (the topic page does not run the lesson's code)."""
    el = copy.copy(el)
    for t in el.find_all(['script', 'button', 'style']):
        t.decompose()
    for t in [el] + el.find_all(True):
        for a in list(t.attrs):
            if a == 'id' or a.startswith('on'):
                del t.attrs[a]
    return el


def parse_quiz(js):
    m = re.search(r'const questions = \[(.*?)\n  \];', js, re.S)
    if not m:
        raise SystemExit('quiz array not found in the lesson')
    body = '[' + m.group(1) + ']'
    body = re.sub(r'^(\s*)(q|qTa|opts|optsTa|correct|explain|explainTa)\s*:', r'\1"\2":', body, flags=re.M)
    body = re.sub(r',(\s*[\]}])', r'\1', body)
    return json.loads(body)


def exercise_id(group_chip, num):
    g = {'Chapter Exercise': 'xc'}.get(group_chip)
    if g is None:
        g = 'x' + re.sub(r'\D', '', group_chip)
    n = re.sub(r'[^0-9a-z]', '', num.lower())
    return '%s_%s' % (g, n)


def parse_exercises(soup):
    out = {}
    sec = soup.find(id='exercises')
    for grp in sec.select('.exgroup'):
        chip = grp.select_one('h3 .chip').get_text(strip=True)
        for item in grp.select('.exitem'):
            num = item.select_one('.exnum').get_text(strip=True)
            qspan = [s for s in item.select('.exq > span') if 'exnum' not in (s.get('class') or [])][0]
            ans = item.select_one('.ex-answer')
            eid = exercise_id(chip, num)
            out[eid] = {
                'id': eid, 'num': num.rstrip('.'), 'group': chip,
                'q': {'en': inner(qspan), 'ta': qspan.get('data-ta')},
                'a': {'en': inner(ans), 'ta': ans.get('data-ta')},
            }
    return out


def build(slug):
    spec = json.load(open(os.path.join(SPECS, slug + '.spec.json'), encoding='utf-8'))
    ch = spec['chapter']
    html = open(os.path.join(LESSONS, ch['lessonFile']), encoding='utf-8').read()
    soup = BeautifulSoup(html, 'html.parser')
    quiz = parse_quiz(html)
    exs = parse_exercises(soup)
    cards = soup.select('#notesStage > .card')
    pills = soup.select('.sns-pill')
    title_en = soup.select_one('.hero h1').get_text(strip=True)
    title_ta = soup.select_one('.hero h1').get('data-ta')
    gaps = []

    def mcq(i):
        q = quiz[i]
        return {'id': 'm%d' % (i + 1), 'kind': 'mcq', 'q': {'en': q['q'], 'ta': q.get('qTa')},
                'opts': {'en': q['opts'], 'ta': q.get('optsTa')}, 'correct': q['correct'],
                'why': {'en': q['explain'], 'ta': q.get('explainTa')}}

    def ex(eid):
        if eid not in exs:
            raise SystemExit('exercise %s not found in the lesson' % eid)
        e = dict(exs[eid]); e['kind'] = 'ex'
        return e

    topics = []
    for n, t in enumerate(spec['topics'], 1):
        card = clean_fragment(cards[t['card']])
        for junk in card.select('.icon-badge, .icon-watermark, .path-explorer, h3'):
            junk.decompose()
        formulas = [str(clean_fragment(b)) for b in cards[t['card']].select('.formula-box')]
        for b in card.select('.formula-grid, .formula-box'):
            b.decompose()
        # the numbered heading on the card ("2.1 Distance vs. Displacement") maps to the textbook section
        h3 = cards[t['card']].find('h3')
        section = re.match(r'^[\d.\s–\-]+', h3.get_text(' ', strip=True).replace('\xa0', ' '))
        authored = t.get('authored', {})
        topic = {
            'id': t['id'], 'n': n,
            'title': {'en': t['title']['en'], 'ta': pills[t['taFromPill']].select('span')[1].get('data-ta')},
            'blurb': t['blurb'], 'learn': t['learn'],
            'section': section.group(0).strip() if section else '',
            'understand': {
                'glance': authored.get('glance'),
                'formulas': formulas,
                'notes': str(card.decode_contents()).strip(),
                'hasLiveDemo': bool(cards[t['card']].select('.path-explorer')),
            },
            'watch': None, 'explore': None,
            'practice': {'items': [], 'selfCheckedOnly': False},
        }
        if t['watch']:
            seg = spec['watchSegments'][t['watch']]
            topic['watch'] = {'title': seg['title'], 'from': seg['from'], 'to': seg['to'], 'seconds': seg['to'] - seg['from'],
                              'src': '/lessons/%s?embed=1&seg=%d-%d&dur=%d#watch' % (ch['lessonFile'], seg['from'], seg['to'], spec['animationSeconds'])}
        ex_t = t.get('explore')
        if ex_t and 'story' in ex_t:
            topic['explore'] = {'type': 'story', **ex_t['story']}
        elif ex_t and 'lab' in ex_t:
            topic['explore'] = {'type': 'lab', 'title': ex_t['lab']['title'], 'src': '/lessons/%s?embed=1#%s' % (ch['lessonFile'], ex_t['lab']['hash'])}
        by_id = {}
        for i in t['practice']['mcq']:
            q = mcq(i); by_id[q['id']] = q
        for eid in t['practice']['ex']:
            by_id[eid] = ex(eid)
        topic['practice']['items'] = [by_id[i] for i in t['practice']['order']]
        # steps that have content; the topic page marks the others "coming soon" and they do not count towards completion
        topic['steps'] = ['understand'] + (['watch'] if topic['watch'] else []) + (['explore'] if topic['explore'] else []) + \
                         (['practice'] if topic['practice']['items'] else [])
        topics.append(topic)

        # what is still missing for this topic (reported, never filled with invented content)
        miss = []
        if not (authored.get('glance')):
            miss.append('Understand: short summary, comparison table and misconceptions (the lesson notes are shown as "Detailed notes")')
        if not topic['watch']:
            miss.append('Watch: no video or animation scene exists for this topic')
        if not topic['explore']:
            miss.append('Explore: no story, scenario or interactive example exists for this topic')
        kinds = {i['kind'] for i in topic['practice']['items']}
        if not topic['practice']['items']:
            miss.append('Practice: no exercises')
        else:
            if 'ex' not in kinds:
                miss.append('Practice: only multiple-choice questions, add numerical / short-answer exercises')
            if 'mcq' not in kinds:
                miss.append('Practice: no multiple-choice questions (everything is self-checked)')
            if len(topic['practice']['items']) < 4:
                miss.append('Practice: only %d question(s)' % len(topic['practice']['items']))
        gaps.append((t['id'], miss))

    rev = spec['revision']
    summ = soup.find(id='summary')
    summary_cards = [str(clean_fragment(c)) for c in summ.select('.card')]
    revision = {
        'summary': summary_cards,
        'formulas': [f for tp in topics for f in tp['understand']['formulas']],
        'mixed': [ex(e) for e in rev['mixedEx']],
        'quiz': [mcq(i) for i in rev['quizMcq']],
    }
    data = {
        'schema': 1,
        'chapter': {'id': ch['id'], 'slug': slug, 'lessonFile': ch['lessonFile'], 'grade': ch['grade'], 'subject': ch['subject'],
                    'title': {'en': title_en, 'ta': title_ta}, 'desc': ch['desc']},
        'topics': topics, 'revision': revision, 'extras': spec['extras'],
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, slug + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')

    # the list the course contents page reads to offer "learn by topic" next to a chapter
    idx_path = os.path.join(OUT, 'index.json')
    idx = {'schema': 1, 'chapters': []}
    if os.path.exists(idx_path):
        idx = json.load(open(idx_path, encoding='utf-8'))
    idx['chapters'] = [c for c in idx['chapters'] if c['slug'] != slug] + [
        {'slug': slug, 'id': ch['id'], 'lessonFile': ch['lessonFile'], 'topics': [{'id': t['id'], 'steps': t['steps']} for t in topics]}]
    idx['chapters'].sort(key=lambda c: c['slug'])
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)
        f.write('\n')

    unassigned = sorted(set(exs) - {i['id'] for t in topics for i in t['practice']['items']} - {e['id'] for e in revision['mixed']})
    print('wrote', os.path.relpath(path, ROOT), '(%d topics, %d bytes)' % (len(topics), os.path.getsize(path)))
    if unassigned:
        print('  lesson exercises not used by any topic or revision:', ', '.join(unassigned))
    print('\nCONTENT STILL TO BE SUPPLIED')
    for tid, miss in gaps:
        print('  %s' % tid)
        for m in miss or ['(nothing missing)']:
            print('    - ' + m)


if __name__ == '__main__':
    slugs = sys.argv[1:] or [os.path.basename(p)[:-len('.spec.json')] for p in sorted(glob.glob(os.path.join(SPECS, '*.spec.json')))]
    for s in slugs:
        build(s)
