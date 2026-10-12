"""Progress v1 -> v2: turns what the current lesson pages save (scx_* keys, stemcloud/progress.py) into progress v2 rows
(stemcloud/progress_v2.py), using stemcloud/legacy_map.json (tools/legacy_map.py).

Used two ways, with the same rules:
- dual-write: every save to the v1 API also writes v2 (progress.save_progress), so both stay in step until cut-over;
- the one-off migration of everything saved so far (tools/migrate_progress_v2.py).
Every rule only ever adds (earliest time, highest count, set flags, the larger XP), so running it twice, or after the
student has also earned v2 progress on the new pages, never takes anything away.

What v1 keys become:
- scx_xp_total -> one "legacy" XP event holding the v1 total (it grows with v1; v2 XP from the new pages adds to it)
- scx_badges -> badges; scx_visit_dates -> activity days
- scx_path_<page> (finished steps by the page's section id) -> those steps done
- scx_story_<page> -> the story done; scx_done_<page> -> the lesson's finish done
- the page's game stars (scx_<...>_stars) -> best stars per level of the lesson's game step
- scx_topics_<page> -> topic steps opened / done (step id "topic:<topic>:<step>") and question attempts
- lessonLang, lessonTheme -> preferences
Anything else (where the student was on a page, lab missions, path checks) stays v1 only: progress v2 does not need it.
"""
import json, re
from pathlib import Path

from .progress_v2 import DAY, ID, SQL

MAP = json.loads((Path(__file__).with_name('legacy_map.json')).read_text(encoding='utf-8'))
STARS = {v['stars_key']: k for k, v in MAP.items() if v.get('stars_key')}
LEGACY_XP = 'legacy-v1'

# the one-off counts of v1: never lower than what is already there (a v2 answer adds 1 on top)
IMPORT_ANSWER = ('INSERT INTO question_attempts(user_id,question_id,attempts,ever_correct,first_try_correct,first_at,last_at) VALUES(?,?,?,?,?,?,?) '
                 'ON CONFLICT(user_id,question_id) DO UPDATE SET '
                 'attempts=CASE WHEN excluded.attempts > question_attempts.attempts THEN excluded.attempts ELSE question_attempts.attempts END, '
                 'ever_correct=CASE WHEN excluded.ever_correct=1 THEN 1 ELSE question_attempts.ever_correct END, '
                 'first_try_correct=CASE WHEN excluded.first_try_correct=1 THEN 1 ELSE question_attempts.first_try_correct END')
LEGACY_XP_SQL = ("INSERT INTO xp_events(user_id,event_id,source,amount,created_at) VALUES(?,'%s','v1',?,?) "
                 'ON CONFLICT(user_id,event_id) DO UPDATE SET amount=CASE WHEN excluded.amount > xp_events.amount THEN excluded.amount ELSE xp_events.amount END'
                 % LEGACY_XP)


def _json(v, default):
    try:
        return json.loads(v)
    except Exception:
        return default


def topic_question(lesson: str, qid: str):
    """A topic page's question id ('m1' quiz question, 'xc_1i' exercise) -> the lesson's question id."""
    if re.fullmatch(r'm\d+', qid):
        q = 'q' + qid[1:]
    else:
        q = qid.replace('_', '-')
    full = '%s/%s' % (lesson, q)
    return full if ID.match(full) and len(full) <= 200 else None


def _step(con, uid, lesson, step, at, done=True):
    con.execute(SQL['step'], (uid, lesson, step, at, at if done else None))


def apply_key(con, uid: int, key: str, value: str, at: int) -> bool:
    """Writes the v2 rows for one v1 key (its whole merged value). True if the key means something in v2."""
    if key == 'scx_xp_total':
        try:
            xp = max(0, int(value))
        except ValueError:
            return False
        con.execute(LEGACY_XP_SQL, (uid, xp, at))
        con.execute('UPDATE users SET xp_total=(SELECT COALESCE(SUM(amount),0) FROM xp_events WHERE user_id=?) WHERE id=?', (uid, uid))
        return True
    if key == 'scx_badges':
        for b in _json(value, []):
            if isinstance(b, str) and len(b) <= 120 and ID.match(b):
                con.execute(SQL['badge'], (uid, b, at))
        return True
    if key == 'scx_visit_dates':
        for d in _json(value, [])[-400:]:
            if isinstance(d, str) and DAY.match(d):
                con.execute(SQL['day'], (uid, d))
        return True
    if key in ('lessonLang', 'lessonTheme'):
        field, ok = ('lang', {'en', 'ta', 'si'}) if key == 'lessonLang' else ('theme', {'light', 'dark'})
        if value not in ok:
            return False
        prefs = {'lang': None, 'theme': None}
        prefs[field] = value
        con.execute(SQL['prefs'], (uid, prefs['lang'], prefs['theme'], None, None, at))
        return True
    if key in STARS:
        page = MAP[STARS[key]]
        if not page.get('game'):
            return False
        for level, stars in enumerate(_json(value, [])):
            if isinstance(stars, int) and not isinstance(stars, bool) and 0 < stars <= 3:
                con.execute(SQL['game'], (uid, '%s/%s' % (page['lesson'], page['game']), level, stars))
        return True
    m = re.fullmatch(r'scx_(path|story|done|topics)_([a-z0-9]+)', key)
    if not m or m.group(2) not in MAP:
        return False
    kind, page = m.group(1), MAP[m.group(2)]
    lesson = page['lesson']
    if kind == 'path':
        for sid, seen in _json(value, {}).items():
            if seen and sid in page['steps']:
                _step(con, uid, lesson, page['steps'][sid], at)
    elif kind == 'story':
        if value == '1':
            _step(con, uid, lesson, 'story', at)
    elif kind == 'done':
        if value == '1':
            _step(con, uid, lesson, 'finish', at)
    elif kind == 'topics':
        for tid, rec in _json(value, {}).items():
            if tid not in page['topics'] or not isinstance(rec, dict):
                continue
            for step in ('understand', 'watch', 'explore', 'practice'):
                v, d = (rec.get('v') or {}).get(step), (rec.get('d') or {}).get(step)
                if v or d:
                    _step(con, uid, lesson, 'topic:%s:%s' % (tid, step), at, done=bool(d))
            for qid, q in (rec.get('q') or {}).items():
                full = topic_question(lesson, qid)
                if not full or not isinstance(q, dict):
                    continue
                n = q.get('n') if isinstance(q.get('n'), int) else 0
                if n > 0:
                    con.execute(IMPORT_ANSWER, (uid, full, min(n, 10000), 1 if q.get('ok') else 0, 1 if q.get('f') else 0, at, at))
    return True


def apply_all(con, uid: int, rows: dict, at_of=None) -> list:
    """Every v1 key of one student; at_of(key) gives the time to use (the row's updated_at). Returns the keys skipped."""
    skipped = []
    for k, v in rows.items():
        if not apply_key(con, uid, k, v, at_of(k) if at_of else 0):
            skipped.append(k)
    return skipped
