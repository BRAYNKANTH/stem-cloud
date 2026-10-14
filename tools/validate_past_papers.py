# -*- coding: utf-8 -*-
"""Check the past paper question banks (content/past-papers/physics/): what the past papers pages and the attempts API
rely on. CI runs it.

    python tools/validate_past_papers.py

For the catalog and every year's bank:
- every catalog entry points at a bank that exists, for the same year, scope "physics";
- question ids are unique across all years and start with "ol<year>-"; numbers and papers (I, II) are set;
- an MCQ has 2-6 options, its answer is one of them, and there is one "why not" explanation per option;
- a written question has parts with unique labels, each with a prompt and a model answer;
- every text a student reads has English (Tamil and Sinhala are optional);
- the scan pages and figures a question shows exist (or are listed as R2 media in .vercelignore);
- the papers the bank lists (I, II) exist, with their instructions.

The explanations (each MCQ, and each part of a written question) are checked for quality too:
- a hint, at least two steps, the idea, why it works, a common mistake and a practice question with its answer,
  each in English, Tamil and Sinhala; the prompt, options, explanation and model answer also have Sinhala;
- no two of the hint, the idea, why it works, the mistake and the answer say the same thing, and no step just
  repeats the answer; the reasons for the options differ from each other;
- a hint written for one question is not reused for another, and none of the old placeholder phrases remain.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BANKS = ROOT / 'content' / 'past-papers' / 'physics'
SCANS = ROOT / 'site' / 'lessons' / 'past-papers'


def r2_media() -> set:
    """Files moved to R2 (listed in .vercelignore between the markers), which may be absent from the repository."""
    text = (ROOT / '.vercelignore').read_text(encoding='utf-8')
    block = text.split('# BEGIN VERIFIED R2 MEDIA')[-1].split('# END VERIFIED R2 MEDIA')[0]
    return {l.strip() for l in block.splitlines() if l.strip()}


def has_en(t) -> bool:
    return isinstance(t, dict) and isinstance(t.get('en'), str) and t['en'].strip() != ''


LANGS = ('en', 'ta', 'si')
# Text left by the first, machine-made explanations; a rewritten bank must not contain it.
PLACEHOLDERS = ('Use the principle in the worked explanation',)


def has_all(t) -> bool:
    return isinstance(t, dict) and all(isinstance(t.get(k), str) and t[k].strip() for k in LANGS)


def norm(t) -> str:
    return re.sub(r'\W+', ' ', (t or {}).get('en', '') if isinstance(t, dict) else '').strip().lower()


def check_explained(at: str, item: dict, answer, hints: dict, problems: list):
    """The explanation sections of one MCQ or written part (see the module notes)."""
    dx = item.get('detailedExplanation') or {}
    practice = dx.get('practice') or {}
    sections = {'hint': item.get('hint'), 'idea': dx.get('concept'), 'why it works': dx.get('reasoning'),
                'mistake': dx.get('commonMistake'), 'practice question': practice.get('question'),
                'practice answer': practice.get('answer')}
    for name, t in sections.items():
        if not has_all(t):
            problems.append('%s: %s needs English, Tamil and Sinhala' % (at, name))
    steps = item.get('steps') or []
    if len(steps) < 2 or not all(has_all(s) for s in steps):
        problems.append('%s: needs at least two steps, each in all three languages' % at)
    seen = {}
    for name in ('hint', 'idea', 'why it works', 'mistake'):
        n = norm(sections[name])
        if n and n in seen:
            problems.append('%s: the %s repeats the %s' % (at, name, seen[n]))
        seen.setdefault(n, name)
    a = norm(answer)
    if a and (a in seen or any(norm(s) == a for s in steps)):
        problems.append('%s: a section or step only repeats the answer' % at)
    h = norm(sections['hint'])
    if h:
        hints.setdefault(h, []).append(at)
    for t in [answer, *sections.values(), *steps, *(item.get('optionExplanations') or [])]:
        if isinstance(t, dict) and any(p in t.get('en', '') for p in PLACEHOLDERS):
            problems.append('%s: still has placeholder text' % at)
            break


def check_bank(year: int, bank: dict, seen: set, media: set, problems: list, hints: dict = None):
    hints = {} if hints is None else hints
    where = '%d.json' % year
    if bank.get('year') != year or bank.get('scope') != 'physics':
        problems.append('%s: year %r / scope %r' % (where, bank.get('year'), bank.get('scope')))
    papers = {p.get('id'): p for p in bank.get('papers', [])}
    for pid, p in papers.items():
        if pid not in ('I', 'II') or not has_en(p.get('instructions')):
            problems.append('%s: paper %r needs id I or II and instructions' % (where, pid))

    def exists(url: str) -> bool:
        rel = url.lstrip('/').replace('lessons/', 'site/lessons/', 1)
        return (ROOT / rel).is_file() or rel in media

    for q in bank.get('questions', []):
        qid = q.get('id', '?')
        at = '%s %s' % (where, qid)
        if not re.fullmatch(r'ol%d-[a-z0-9-]+' % year, str(qid)):
            problems.append('%s: id must start with ol%d-' % (at, year))
        if qid in seen:
            problems.append('%s: id used twice' % at)
        seen.add(qid)
        if q.get('paper') not in papers or not isinstance(q.get('number'), int):
            problems.append('%s: paper %r / number %r' % (at, q.get('paper'), q.get('number')))
        if not has_en(q.get('prompt')):
            problems.append('%s: prompt needs English' % at)
        if q.get('type') == 'mcq':
            opts = q.get('options') or []
            if not 2 <= len(opts) <= 6 or not all(has_en(o) for o in opts):
                problems.append('%s: %d options (2-6, each with English)' % (at, len(opts)))
            if not (isinstance(q.get('correct'), int) and 0 <= q['correct'] < len(opts)):
                problems.append('%s: the answer %r is not one of its options' % (at, q.get('correct')))
            reasons = q.get('optionExplanations') or []
            if len(reasons) != len(opts):
                problems.append('%s: one "why not" explanation per option' % at)
            elif not all(has_all(r) for r in reasons) or len({norm(r) for r in reasons}) != len(reasons):
                problems.append('%s: each option needs its own reason, in all three languages' % at)
            if not has_en(q.get('explanation')):
                problems.append('%s: explanation needs English' % at)
            worded = [o for o in opts if o.get('ta', o.get('en')) != o.get('en')]   # "310 K" reads the same everywhere
            if not (q.get('prompt', {}).get('si') and q.get('explanation', {}).get('si') and all(o.get('si') for o in worded)):
                problems.append('%s: prompt, options and explanation need Sinhala' % at)
            check_explained(at, q, q.get('explanation'), hints, problems)
        elif q.get('type') == 'written':
            labels = [p.get('label') for p in q.get('parts') or []]
            if not labels or len(set(labels)) != len(labels) or not all(labels):
                problems.append('%s: parts need unique labels' % at)
            for p in q.get('parts') or []:
                pat = '%s part %s' % (at, p.get('label'))
                if not (has_en(p.get('prompt')) and has_en(p.get('answer'))):
                    problems.append('%s: prompt and model answer need English' % pat)
                if not (p.get('prompt', {}).get('si') and p.get('answer', {}).get('si')):
                    problems.append('%s: prompt and model answer need Sinhala' % pat)
                check_explained(pat, p, p.get('answer'), hints, problems)
            if not q.get('prompt', {}).get('si'):
                problems.append('%s: prompt needs Sinhala' % at)
        else:
            problems.append('%s: type %r' % (at, q.get('type')))
        for n in q.get('pages') or []:
            url = '/lessons/past-papers/%d/page-%02d.jpg' % (year, n)
            if not exists(url):
                problems.append('%s: scan page %d is missing (%s)' % (at, n, url))
        if q.get('figure') and not exists(q['figure']):
            problems.append('%s: figure %s is missing' % (at, q['figure']))


def main():
    problems, seen, media, hints = [], set(), r2_media(), {}
    catalog = json.loads((BANKS / 'catalog.json').read_text(encoding='utf-8'))
    years = []
    for p in catalog.get('papers', []):
        if not p.get('bank'):
            continue
        m = re.fullmatch(r'/lessons/past-papers/(\d{4})\.json', p['bank'])
        if not m or int(m.group(1)) != p.get('year') or not (BANKS / (m.group(1) + '.json')).is_file():
            problems.append('catalog: %r points at no bank of its year' % p.get('bank'))
            continue
        years.append(p['year'])
    for f in sorted(BANKS.glob('[0-9][0-9][0-9][0-9].json')):
        if int(f.stem) not in years:
            problems.append('%s is not in the catalog' % f.name)
    counts = {}
    for y in years:
        bank = json.loads((BANKS / ('%d.json' % y)).read_text(encoding='utf-8'))
        check_bank(y, bank, seen, media, problems, hints)
        counts[y] = len(bank.get('questions', []))
    for h, ats in hints.items():
        if len(ats) > 1:
            problems.append('the same hint is used for %s: write one for each question' % ', '.join(ats))
    for y, n in counts.items():
        print('  %d  %3d questions' % (y, n))
    if problems:
        print('\nPROBLEMS')
        for x in problems[:60]:
            print('  - ' + x)
        sys.exit(1)
    print('all %d banks valid (%d questions)' % (len(counts), sum(counts.values())))


if __name__ == '__main__':
    main()
