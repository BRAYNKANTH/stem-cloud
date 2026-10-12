# -*- coding: utf-8 -*-
"""Extract a chapter from its lesson page into the lesson format (content/<subject>/g<grade>/<slug>/lesson.json).

    python tools/extract_lesson.py unit-02-motion-in-a-straight-line     # one chapter (the lesson file name without .html)
    python tools/extract_lesson.py --all                                 # every chapter listed on the course home

Nothing in the lesson page is changed. What is extracted:
- English and Tamil exactly as a student sees them today: the Tamil version of a block is the English block with every element
  that has a data-ta replaced by that Tamil (what the page's language switch does).
- the story (const STORY in the page) with the recorded Tamil voices; the self-check quiz (const questions);
- notes, basics, activities, worked examples, textbook exercises, recap and summary as safe HTML (no ids outside drawings,
  no event handlers, no scripts);
- the lab, the game, the sort game and the animation as links to the lesson page section (they are rebuilt later);
- drawings the page's script draws into an empty <svg> when it loads, from tools/drawn_figures.json (captured once in a
  browser by tools/drawn_figures.py).
Anything it cannot carry over is listed under "NOT CARRIED OVER", never guessed. Sinhala is added by milestone 4.3.
"""
import copy, json, re, subprocess, sys
from pathlib import Path

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content_schema.lesson import Lesson  # noqa: E402
from tools.sinhala import Sinhala  # noqa: E402

PAGES = ROOT / 'site' / 'lessons'
AUDIO = ROOT / 'public' / 'static' / 'audio' / 'story'
CONTENT = ROOT / 'content'
DRAWN = json.loads((ROOT / 'tools' / 'drawn_figures.json').read_text(encoding='utf-8'))
GAMES = {'challenge', 'holdgame', 'pushit', 'tugofwar', 'balancegame'}
SKIP_SECTIONS = {'fw_path', 'fw_finish'}          # the lesson's own start and finish screens (app chrome, not content)
NL, CR = chr(10), chr(13)
SI: Sinhala | None = None                         # the chapter's Sinhala translation memory, set by extract()
DROP_INTERACTIVE = ['.path-explorer']             # small live demos inside notes; they need the lesson's script
# Interface parts of a lesson page, not content: section labels, chips, navigation, score lines and reveal buttons.
# Everything else in a section is carried over; the self-check ignores only these.
CHROME = ['.section-label', '.so-chip', '.so-quest-head', '.subtopic-nav-strip', '.stage-nav', '.quiz-score', '.ex-toggle',
          '.step-toggle', '.final-toggle', '.act-done', 'table.gloss th']


# ----------------------------------------------------------------------------------------------- chapters
def chapters() -> list[dict]:
    """The chapter list of the course home (site/lessons/index.html, const LESSONS / MODULES), read with Node."""
    src = (PAGES / 'index.html').read_text(encoding='utf-8')
    block = src[src.index('const MODULES'): src.index('/* Today counts as a visit')]
    js = block + '\nprocess.stdout.write(JSON.stringify(LESSONS));'
    out = subprocess.run(['node', '-e', js], capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def slug_of(file: str) -> str:
    """chapter-05-friction.html -> friction; g10-chapter-15-hydrostatic-pressure.html -> hydrostatic-pressure."""
    return re.sub(r'^(?:g\d+-)?(?:chapter|unit)-\d+-', '', file[:-len('.html')])


# ----------------------------------------------------------------------------------------------- html helpers
def inner(el) -> str:
    return ''.join(str(c) for c in el.contents).strip()


TAMIL_TAG_TYPO = re.compile('</([a-z]+)([஀-௿]+)')     # e.g. "</b்": a Tamil vowel sign typed inside the closing tag
REPAIRS: list = []


def repair_tamil(html: str) -> str:
    fixed = TAMIL_TAG_TYPO.sub(lambda m: m.group(2) + '</' + m.group(1) + '>', html)
    if fixed != html:
        REPAIRS.append(' '.join(BeautifulSoup(html, 'html.parser').get_text(' ').split())[:70])
    return fixed


def tamil_version(el: Tag) -> Tag | None:
    """The element as a student reading Tamil sees it: every [data-ta] element's content replaced by its data-ta
    (outermost first, as the page does). None if nothing in it has Tamil."""
    if not (el.get('data-ta') or el.select('[data-ta]')):
        return None
    el = copy.copy(el)

    def swap(node):
        for child in list(node.children):
            if isinstance(child, Tag):
                if child.get('data-ta') is not None:
                    child.clear()
                    frag = BeautifulSoup(repair_tamil(child['data-ta']), 'html.parser')
                    for part in list(frag.contents):
                        child.append(part)
                else:
                    swap(child)
    if el.get('data-ta') is not None:
        wrapper = BeautifulSoup('<div></div>', 'html.parser').div
        wrapper.append(el)
        swap(wrapper)
        return wrapper.contents[0]
    swap(el)
    return el


def clean(el: Tag, report: list | None = None, where: str = '') -> Tag:
    """A safe copy: no scripts or styles, no event handlers, no ids outside drawings, no data-ta/data-en."""
    el = copy.copy(el)
    for t in el.find_all(['script', 'style', 'noscript']):
        t.decompose()
    for sel in DROP_INTERACTIVE:
        for t in el.select(sel):
            if report is not None:
                report.append('%s: a live demo (%s) inside the text needs the lesson script; left out' % (where, sel))
            t.decompose()
    for t in [el] + el.find_all(True):
        in_svg = t.name == 'svg' or t.find_parent('svg') is not None
        for a in list(t.attrs):
            if a.startswith('on') or a in ('data-ta', 'data-en', 'data-si') or (a == 'id' and not in_svg) or a == 'tabindex':
                del t.attrs[a]
    return el


def rich(el: Tag, report: list, where: str, drop: str = '') -> dict | None:
    """{en, ta} safe HTML of an element's content; `drop` is a CSS selector of parts to leave out (e.g. its heading)."""
    if el is None:
        return None
    en_el = copy.copy(el)
    ta_el = tamil_version(el)
    si_el = SI.version(el) if SI else None
    out = {}
    for lang, node in (('en', en_el), ('ta', ta_el), ('si', si_el)):
        if node is None:
            continue
        if drop:
            for t in node.select(drop):
                t.decompose()
        html = inner(clean(node, report if lang == 'en' else None, where)).strip()
        if html:
            out[lang] = html
    return out or None


def text(el: Tag) -> dict | None:
    """{en, ta} plain text of an element (its data-ta as text for Tamil)."""
    if el is None:
        return None
    en = ' '.join(el.get_text(' ', strip=True).split())
    if not en:
        return None
    out = {'en': en}
    ta_el = tamil_version(el)
    if ta_el is not None:
        ta = ' '.join(ta_el.get_text(' ', strip=True).split())
        if ta and ta != en:
            out['ta'] = ta
    si_el = SI.version(el) if SI else None
    if si_el is not None:
        si = ' '.join(si_el.get_text(' ', strip=True).split())
        if si and si != en:
            out['si'] = si
    return out


def tri(en: str, ta: str | None = None) -> dict:
    """A plain string from the page's script data, with its Tamil and the Sinhala the translation memory has."""
    out = {'en': en}
    if ta:
        out['ta'] = ta
    si = SI.text(en) if SI else None
    if si:
        out['si'] = si
    return out


def heading(sec: Tag) -> dict:
    label = sec.select_one('.section-label')
    h2 = label.find('h2') if label else None
    sub = label.select_one('.sub') if label else None
    h = {'title': text(h2) or {'en': sec.get('id', '').title()}}
    if text(sub):
        h['sub'] = text(sub)
    return h


# ----------------------------------------------------------------------------------------------- sections
def story(sec: Tag, html: str, legacy_id: str, report: list) -> dict | None:
    data = js_literal(html, 'STORY')
    if not data:
        report.append('story: const STORY not found in the page')
        return None
    lines = []
    for i, (who, scene, en, ta) in enumerate(data['lines']):
        line = {'speaker': {'R': 'raja', 'C': 'chittu'}[who], 'text': tri(en, ta)}
        if scene:
            line['scene'] = scene
        mp3 = AUDIO / legacy_id / ('line%02d.mp3' % i)
        if mp3.exists():
            line['audio'] = {'ta': '%s/line%02d.mp3' % (legacy_id, i)}
        lines.append(line)
    step = {'type': 'story', 'id': 'story', 'title': tri(data['title'][0], data['title'][1]), 'lines': lines}
    if data.get('cta'):
        step['cta'] = tri(data['cta'][0], data['cta'][1])
    quest = sec.select_one('.so-quest p')
    if quest is not None:
        step['quest'] = rich(quest, report, 'story quest')
    return step


def basics(sec: Tag, report: list) -> dict:
    cards = []
    for li in sec.select('li.bs-card'):
        body = li.select_one('.bs-body')
        cards.append({'title': text(body.find('h3')), 'body': rich(body, report, 'basics card', drop='h3'),
                      'icon': li.select_one('.bs-ic').get_text(strip=True) if li.select_one('.bs-ic') else None})
    step = {'type': 'basics', 'id': 'basics', 'heading': heading(sec), 'cards': [{k: v for k, v in c.items() if v} for c in cards]}
    hook = sec.select_one('.bs-hook p')
    if hook is not None:
        step['hook'] = rich(hook, report, 'basics hook')
    extra = leftovers(sec, report, 'basics', used=['.bs-hook', 'ol.bs-list'])
    if extra:
        step['extra'] = extra
    return step


def leftovers(sec: Tag, report: list, where: str, used: list) -> list:
    """The section's other top-level blocks (not its label, the interface parts or the parts already used), as they are."""
    out = []
    skip = ids(sec, used + CHROME)
    for child in sec.find_all(True, recursive=False):
        if id(child) in skip:
            continue
        r = rich_block(child, report, where)
        if r:
            out.append(r)
    return out


def rich_block(el: Tag, report: list, where: str) -> dict | None:
    """Like rich(), but keeps the element itself (its class gives the block its look, e.g. a callout)."""
    wrapper = BeautifulSoup('<div></div>', 'html.parser').div
    wrapper.append(copy.copy(el))
    return rich(wrapper, report, where, drop=', '.join(CHROME))


def notes(sec: Tag, report: list) -> dict:
    cards = []
    for i, card in enumerate(sec.select('#notesStage > .card'), 1):
        h3 = card.find('h3')
        title = text(h3)
        num = re.match(r'^\s*([\d.]+(?:\s*[–-]\s*[\d.]+)?)\s+', title['en']) if title else None
        c = {'title': title, 'body': rich(card, report, 'notes card %d' % i, drop='h3, .icon-badge, .icon-watermark')}
        if num:
            c['section'] = num.group(1).replace(' ', '')
        cards.append(c)
    step = {'type': 'notes', 'id': 'notes', 'heading': heading(sec), 'cards': cards}
    intro = sec.select_one('.notes-anchor p')
    if intro is not None:
        step['intro'] = rich(intro, report, 'notes intro')
    extra = []
    for child in sec.find_all(True, recursive=False):
        if child.get('id') == 'notesStage':
            extra += leftovers(child, report, 'notes', used=[':scope > .card'])
        elif id(child) not in ids(sec, ['.notes-anchor', '.notes-path', '#notesPath'] + CHROME):
            r = rich_block(child, report, 'notes')
            if r:
                extra.append(r)
    if extra:
        step['extra'] = extra
    return step


def body_after_label(sec: Tag, report: list, where: str) -> dict:
    return rich(sec, report, where, drop='.section-label')


def js_literal(html: str, name: str):
    """The value of `const <name> = <array or object literal>` in the page's script, evaluated by Node in an empty
    sandbox (these are the repository's own lesson files). The literal's end is found by matching brackets outside strings."""
    m = re.search(r'\bconst %s\s*=\s*([\[{])' % re.escape(name), html)
    if not m:
        return None
    i, depth, quote, esc = m.start(1), 0, None, False
    for j in range(i, len(html)):
        ch = html[j]
        if quote:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == quote:
                quote = None
        elif ch in '"\'`':
            quote = ch
        elif ch in '[{':
            depth += 1
        elif ch in ']}':
            depth -= 1
            if depth == 0:
                literal = html[i:j + 1]
                break
    else:
        return None
    js = "const vm=require('vm');let s='';process.stdin.on('data',c=>s+=c).on('end',()=>process.stdout.write(JSON.stringify(vm.runInNewContext('('+s+')',{},{timeout:2000}))));"
    out = subprocess.run(['node', '-e', js], input=literal, capture_output=True, text=True, encoding='utf-8')
    if out.returncode:
        raise SystemExit('could not read const %s: %s' % (name, out.stderr.strip()[:300]))
    return json.loads(out.stdout)


def quiz(html: str, report: list) -> dict | None:
    data = js_literal(html, 'questions')
    if not data:
        report.append('quiz: const questions not found in the page')
        return None
    qs = []
    for i, q in enumerate(data, 1):
        opts_ta = q.get('optsTa') or [None] * len(q['opts'])
        item = {'id': 'q%d' % i, 'prompt': tri(q['q'], q.get('qTa')),
                'options': [tri(o, t) for o, t in zip(q['opts'], opts_ta)], 'answer': q['correct']}
        if q.get('explain'):
            item['explain'] = tri(q['explain'], q.get('explainTa'))
        qs.append(item)
    return qs


def worked(sec: Tag, report: list) -> list:
    out = []
    for i, card in enumerate(sec.select('.qcard'), 1):
        ex = {'id': 'w%d' % i, 'body': rich(card, report, 'worked example %d' % i, drop='.qtag')}
        if text(card.select_one('.qtag')):
            ex['tag'] = text(card.select_one('.qtag'))
        out.append(ex)
    return out


def exercise_id(chip: str, num: str) -> str:
    g = 'xc' if chip.lower().startswith('chapter') else 'x' + re.sub(r'\D', '', chip)
    return '%s-%s' % (g if g != 'x' else 'xx', re.sub(r'[^0-9a-z]', '', num.lower()) or 'n')


def exercises(sec: Tag, report: list) -> list:
    groups, seen = [], set()
    for grp in sec.select('.exgroup'):
        h3 = grp.find('h3')
        chip_el = h3.select_one('.chip') if h3 else None
        title_el = [s for s in h3.find_all('span', recursive=False) if 'chip' not in (s.get('class') or [])] if h3 else []
        chip = text(chip_el) or {'en': 'Exercise'}
        items = []
        for item in grp.select('.exitem'):
            num = item.select_one('.exnum').get_text(strip=True).rstrip('.') if item.select_one('.exnum') else str(len(items) + 1)
            eid = exercise_id(chip['en'], num)
            while eid in seen:
                eid += 'b'
            seen.add(eid)
            ans = item.select_one('.ex-answer')
            # every part of the question (some have (a), (b) parts and a table between them), not the answer
            e = {'id': eid, 'num': num, 'prompt': rich(item, report, 'exercise %s' % num, drop='.ex-answer, .ex-toggle, .exq:first-child > .exnum')}
            if ans is not None:
                e['answer'] = rich(ans, report, 'exercise %s answer' % num)
            items.append(e)
        g = {'chip': chip, 'items': items}
        if title_el and text(title_el[0]):
            g['title'] = text(title_el[0])
        groups.append(g)
    return groups


def summary(sec: Tag, report: list) -> dict:
    points = [rich(li, report, 'summary point') for li in sec.select('ol.sumlist > li')]
    glossary = []
    for tr in sec.select('table.gloss tr'):
        tt, te = tr.select_one('td.tt'), tr.select_one('td.te')
        if tt and te and te.get_text(strip=True):
            term = {'en': te.get_text(' ', strip=True), 'ta': tt.get_text(' ', strip=True)}
            si_term = SI.lookup('@' + te.get_text(' ', strip=True)) if SI else None
            if si_term:
                term['si'] = BeautifulSoup(si_term, 'html.parser').get_text(' ', strip=True)
            meaning = [td for td in tr.find_all('td') if td is not tt and td is not te]
            if meaning and text(meaning[0]):
                term['meaning'] = text(meaning[0])
            glossary.append(term)
    extra = []
    for card in sec.select(':scope > .card'):
        if card.select_one('ol.sumlist') or card.select_one('table.gloss'):
            continue
        extra.append(rich(card, report, 'summary card'))
    step = {'type': 'summary', 'id': 'summary', 'heading': heading(sec), 'points': [p for p in points if p], 'glossary': glossary}
    sum_card = next((c for c in sec.select(':scope > .card') if c.select_one('ol.sumlist')), None)
    gloss_card = next((c for c in sec.select(':scope > .card') if c.select_one('table.gloss')), None)
    if sum_card is not None and text(sum_card.find('h3')):
        step['points_title'] = text(sum_card.find('h3'))
    if gloss_card is not None and text(gloss_card.find('h3')):
        step['glossary_title'] = text(gloss_card.find('h3'))
    if extra:
        step['extra'] = [e for e in extra if e]
    return step


# ----------------------------------------------------------------------------------------------- the chapter
def fill_drawings(file: str, html: str) -> str:
    """Empty <svg id="..."> elements that the page's script draws into, filled with the captured drawing."""
    for svg_id, inner_svg in DRAWN.get(file, {}).items():
        html = re.sub(r'(<svg\b[^>]*\bid="%s"[^>]*>)\s*(</svg>)' % re.escape(svg_id), lambda m: m.group(1) + inner_svg + m.group(2), html)
    return html


def extract(file: str, meta: dict) -> tuple[dict, list]:
    global SI
    SI = Sinhala(file[:-len('.html')])
    html = fill_drawings(file, (PAGES / file).read_text(encoding='utf-8'))
    soup = BeautifulSoup(html, 'html.parser')
    report = []
    slug = slug_of(file)
    grade = int(meta['m'][1:])
    lesson = {'schema': 2, 'id': 'physics.g%d.%s' % (grade, slug), 'slug': slug, 'subject': 'physics', 'grade': grade,
              'number': meta['n'], 'title': {k: meta[k] for k in ('en', 'ta', 'si') if meta.get(k)},
              'legacy': {'id': meta['lid'], 'file': file}, 'steps': []}
    steps = lesson['steps']
    for sec in soup.select('section.block[id]'):
        sid = sec['id']
        if sid in SKIP_SECTIONS:
            continue
        if sid == 'story':
            s = story(sec, html, meta['lid'], report)
            if s:
                steps.append(s)
        elif sid == 'basics':
            steps.append(basics(sec, report))
        elif sid == 'watch':
            steps.append({'type': 'watch', 'id': 'watch', 'heading': heading(sec), 'animation': {'file': file, 'hash': 'watch'}})
        elif sid == 'notes':
            steps.append(notes(sec, report))
        elif sid == 'activities':
            steps.append({'type': 'activities', 'id': 'activities', 'heading': heading(sec), 'body': body_after_label(sec, report, 'activities')})
        elif sid == 'lab':
            steps.append({'type': 'lab', 'id': 'lab', 'heading': heading(sec), 'legacy': {'file': file, 'hash': 'lab'}})
        elif sid in GAMES:
            steps.append({'type': 'game', 'id': sid, 'kind': sid, 'heading': heading(sec), 'legacy': {'file': file, 'hash': sid}})
        elif sid == 'sortgame':
            steps.append({'type': 'sort', 'id': 'sort', 'heading': heading(sec), 'legacy': {'file': file, 'hash': sid}})
        elif sid == 'quiz':
            qs = quiz(html, report)
            if qs:
                steps.append({'type': 'quiz', 'id': 'quiz', 'heading': heading(sec), 'questions': qs})
        elif sec.select_one('.qcard'):          # worked examples ("walkthroughs", "examples", or "practice" in unit 2)
            steps.append({'type': 'worked', 'id': 'worked', 'heading': heading(sec), 'examples': worked(sec, report)})
        elif sec.select_one('.exgroup'):        # textbook exercises ("practice", or "exercises" in unit 2)
            steps.append({'type': 'exercises', 'id': 'exercises', 'heading': heading(sec), 'groups': exercises(sec, report)})
        elif sid == 'recap':
            steps.append({'type': 'recap', 'id': 'recap', 'heading': heading(sec),
                          'cards': [c for c in (rich(card, report, 'recap card') for card in sec.select(':scope > .card')) if c]})
        elif sid == 'summary':
            steps.append(summary(sec, report))
        else:
            report.append('section #%s: unknown kind; left out' % sid)
    return lesson, report


def carried_over(file: str, lesson: dict) -> dict:
    """Self-check: every English and Tamil text unit ([data-ta] elements) of the sections that were extracted as text must
    appear in the lesson JSON. Returns counts and the units that are missing."""
    soup = BeautifulSoup((PAGES / file).read_text(encoding='utf-8'), 'html.parser')
    as_text = {'story', 'basics', 'notes', 'activities', 'quiz', 'recap', 'summary'} | {
        sec['id'] for sec in soup.select('section.block[id]') if sec.select_one('.qcard, .exgroup')}
    flat = ' '.join(BeautifulSoup(' '.join(_strings(lesson)), 'html.parser').get_text(' ').split())
    out = {'en': [0, 0, []], 'ta': [0, 0, []]}
    for sec in soup.select('section.block[id]'):
        if sec['id'] not in as_text:
            continue
        chrome = ids(sec, CHROME)
        for el in sec.select('[data-ta]'):
            if el.find_parent(class_=lambda c: c in DROP_INTERACTIVE_CLASSES) or                     id(el) in chrome or any(id(p) in chrome for p in el.parents):
                continue
            for lang, value in (('en', el.get_text(' ')), ('ta', BeautifulSoup(repair_tamil(el['data-ta']), 'html.parser').get_text(' '))):
                v = ' '.join(value.split())
                if not v:
                    continue
                out[lang][1] += 1
                if v in flat:
                    out[lang][0] += 1
                else:
                    out[lang][2].append('#%s: %s' % (sec['id'], v[:70]))
    return out


def _strings(node):
    if isinstance(node, dict):
        for v in node.values():
            yield from _strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v)
    elif isinstance(node, str):
        yield node


DROP_INTERACTIVE_CLASSES = {sel.lstrip('.') for sel in DROP_INTERACTIVE}


def ids(sec: Tag, selectors: list) -> set:
    """Identities of the elements matching any selector (BeautifulSoup compares tags by content, which is slow)."""
    return {id(t) for sel in selectors for t in sec.select(sel)}


def write(lesson: dict) -> Path:
    Lesson.model_validate(lesson)          # never write a file that does not match the format
    out = CONTENT / lesson['subject'] / ('g%d' % lesson['grade']) / lesson['slug'] / 'lesson.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(lesson, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
    return out


def main():
    args = sys.argv[1:]
    check = '--check' in args
    args = [a for a in args if a != '--check']
    all_chapters = {c['file']: c for c in chapters()}
    files = list(all_chapters) if args == ['--all'] else [a if a.endswith('.html') else a + '.html' for a in args]
    if not files:
        sys.exit(__doc__)
    if check:
        # CI: content/ must be what the lesson pages give today, and no text unit may be lost
        problems = []
        for f in files:
            REPAIRS.clear()
            lesson, _ = extract(f, all_chapters[f])
            Lesson.model_validate(lesson)
            out = CONTENT / lesson['subject'] / ('g%d' % lesson['grade']) / lesson['slug'] / 'lesson.json'
            want = json.dumps(lesson, ensure_ascii=False, indent=1) + NL
            if not out.exists() or out.read_text(encoding='utf-8').replace(CR + NL, NL) != want:
                problems.append('%s is out of date with site/lessons/%s' % (out.relative_to(ROOT).as_posix(), f))
            c = carried_over(f, lesson)
            for lang in ('en', 'ta'):
                if c[lang][2]:
                    problems.append('%s: %d %s text unit(s) not carried over, e.g. %s' % (f, len(c[lang][2]), lang, c[lang][2][0]))
        if problems:
            sys.exit(NL.join(problems) + NL + '(run python tools/extract_lesson.py --all)')
        print('content/ matches all %d lesson pages; every text unit carried over' % len(files))
        return
    for f in files:
        if f not in all_chapters:
            sys.exit('%s is not on the course home' % f)
        REPAIRS.clear()
        lesson, report = extract(f, all_chapters[f])
        report += ['Tamil typo repaired (a vowel sign inside a closing tag, fix it in the lesson too): %s' % r for r in dict.fromkeys(REPAIRS)]
        out = write(lesson)
        print('%s -> %s (%d steps, %d KB)' % (f, out.relative_to(ROOT).as_posix(), len(lesson['steps']), out.stat().st_size // 1024))
        print('   steps: ' + ', '.join(s['type'] + ('' if s['type'] == s['id'] else ':' + s['id']) for s in lesson['steps']))
        for r in report:
            print('   NOT CARRIED OVER  ' + r)
        c = carried_over(f, lesson)
        for lang, name in (('en', 'English'), ('ta', 'Tamil')):
            got, total, missing = c[lang]
            print('   %s text units carried over: %d / %d' % (name, got, total))
            for m in missing[:8]:
                print('      missing ' + m)


if __name__ == '__main__':
    main()
