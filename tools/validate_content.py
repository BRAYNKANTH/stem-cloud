# -*- coding: utf-8 -*-
"""Check every lesson in content/ and keep the course catalog and the id registry current.

    python tools/validate_content.py            # CI: validate, report translation coverage, fail on any problem
    python tools/validate_content.py --write    # also rewrite content/catalog.json and record new ids in content/_ids.json

For each content/<subject>/g<grade>/<slug>/lesson.json:
- it must match the lesson format (content_schema/lesson.py) and sit at the path its id names;
- every legacy part must point at a section that exists in that lesson page (site/lessons/<file>, id="<hash>");
- ids that have shipped (content/_ids.json) must still exist, unless content/_renames.json says where they went:
  saved progress refers to them;
- content/catalog.json (the course list the pages read) must be up to date.
It prints how much of each lesson has Tamil and Sinhala, so missing translations are visible, never invented.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pydantic import BaseModel, ValidationError  # noqa: E402
from content_schema.lesson import Lesson, Legacy, Rich, Text  # noqa: E402

CONTENT = ROOT / 'content'
LESSON_PAGES = ROOT / 'site' / 'lessons'
CATALOG = CONTENT / 'catalog.json'
IDS = CONTENT / '_ids.json'
RENAMES = CONTENT / '_renames.json'


def load_json(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def walk(node):
    """Every model inside a lesson, depth first."""
    yield node
    if isinstance(node, list):
        for x in node:
            yield from walk(x)
    elif isinstance(node, BaseModel):
        for name in type(node).model_fields:
            yield from walk(getattr(node, name))


def all_ids(lesson: Lesson) -> list[str]:
    """Ids progress can refer to: the lesson, its steps, and its questions, exercises and examples."""
    out = [lesson.id]
    for s in lesson.steps:
        out.append('%s/%s' % (lesson.id, s.id))
        for n in walk(s):
            if n is not s and isinstance(n, BaseModel) and isinstance(getattr(n, 'id', None), str):
                out.append('%s/%s' % (lesson.id, n.id))
    return out


def coverage(lesson: Lesson) -> dict:
    texts = [n for n in walk(lesson) if isinstance(n, (Text, Rich))]
    total = len(texts) or 1
    return {'texts': len(texts), 'ta': round(100 * sum(1 for t in texts if t.ta) / total), 'si': round(100 * sum(1 for t in texts if t.si) / total)}


def check_legacy(lesson: Lesson, problems: list):
    pages = {}
    for n in walk(lesson):
        if isinstance(n, Legacy):
            path = LESSON_PAGES / n.file
            if n.file not in pages:
                pages[n.file] = path.read_text(encoding='utf-8') if path.exists() else None
            if pages[n.file] is None:
                problems.append('%s: legacy page %s does not exist' % (lesson.id, n.file))
            elif not re.search(r'\bid="%s"' % re.escape(n.hash), pages[n.file]):
                problems.append('%s: legacy page %s has no section id="%s"' % (lesson.id, n.file, n.hash))


def catalog_of(lessons: list[Lesson]) -> dict:
    def num(l):
        m = re.match(r'\d+', l.number)
        return (int(m.group(0)) if m else 999, l.number)
    entries = sorted(lessons, key=lambda l: (l.subject, l.grade, num(l)))
    return {'schema': 1, 'lessons': [
        {'id': l.id, 'subject': l.subject, 'grade': l.grade, 'number': l.number, 'slug': l.slug,
         'title': l.title.model_dump(exclude_none=True), 'path': 'content/%s/g%d/%s/lesson.json' % (l.subject, l.grade, l.slug),
         'legacy': l.legacy.model_dump() if l.legacy else None, 'steps': [s.type for s in l.steps]}
        for l in entries]}


def main():
    write = '--write' in sys.argv
    problems, lessons = [], []
    files = sorted(CONTENT.glob('*/g*/*/lesson.json')) if CONTENT.exists() else []
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        try:
            lesson = Lesson.model_validate_json(f.read_text(encoding='utf-8'))
        except ValidationError as e:
            problems.append('%s: %d problem(s)\n    %s' % (rel, e.error_count(), str(e).replace('\n', '\n    ')))
            continue
        want = 'content/%s/g%d/%s/lesson.json' % (lesson.subject, lesson.grade, lesson.slug)
        if rel != want:
            problems.append('%s: should be at %s' % (rel, want))
        check_legacy(lesson, problems)
        lessons.append(lesson)

    shipped = load_json(IDS, {'ids': []})['ids']
    renames = load_json(RENAMES, {})
    current = sorted({i for l in lessons for i in all_ids(l)})
    gone = [i for i in shipped if i not in current and i not in renames]
    if gone:
        problems.append('ids that have shipped are gone (record the move in content/_renames.json):\n    ' + '\n    '.join(gone[:50]))

    catalog = catalog_of(lessons)
    catalog_text = json.dumps(catalog, ensure_ascii=False, indent=1) + '\n'
    if write:
        CONTENT.mkdir(exist_ok=True)
        CATALOG.write_text(catalog_text, encoding='utf-8', newline='\n')
        IDS.write_text(json.dumps({'ids': sorted(set(shipped) | set(current))}, indent=1) + '\n', encoding='utf-8', newline='\n')
    elif lessons and (not CATALOG.exists() or CATALOG.read_text(encoding='utf-8').replace('\r\n', '\n') != catalog_text):
        problems.append('content/catalog.json is out of date (run python tools/validate_content.py --write)')
    elif lessons and set(current) - set(shipped):
        problems.append('new ids are not recorded in content/_ids.json (run python tools/validate_content.py --write)')

    print('%d lesson(s) in content/' % len(lessons))
    for l in lessons:
        c = coverage(l)
        print('  %-55s %2d steps  %4d texts  Tamil %3d%%  Sinhala %3d%%' % (l.id, len(l.steps), c['texts'], c['ta'], c['si']))
    if problems:
        print('\nPROBLEMS')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    print('all lessons valid')


if __name__ == '__main__':
    main()
