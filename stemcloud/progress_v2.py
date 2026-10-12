"""Lesson progress v2 (docs/migration-plan-astro.md, section 3.5): typed tables fed by idempotent events.

A device writes what the student did as events, each with its own event_id, and sends them in batches (an outbox, so
it works offline). The server applies each event once, with rules that only move forward:
- a repeated event_id is ignored, so replaying an outbox is harmless;
- a step opened or done keeps the earliest time; done never goes back to not done;
- a question counts every attempt; "ever correct" stays set; "right at the first try" comes from the earliest answer,
  whatever order the events arrive in;
- a game keeps the best stars per level; a badge keeps the first time it was earned; XP is added once per event;
- preferences take the newest change.
So a phone that was offline for a week, or two devices used in turns, can never wipe newer progress.
"""
import re, time
from datetime import date

ID = re.compile(r'^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$')
EVENT_ID = re.compile(r'^[A-Za-z0-9_-]{8,64}$')
DAY = re.compile(r'^\d{4}-\d{2}-\d{2}$')
MAX_EVENTS = 200            # per request
MAX_XP = 100                # per event
EARLIEST = 1704067200       # 2024-01-01: older times are a device clock problem
PREFS = {'lang': {'en', 'ta', 'si'}, 'theme': {'light', 'dark'}, 'motion': {'on', 'off'}, 'reading_mode': {'step', 'scroll'}}
KINDS = {'step_open', 'step_done', 'answer', 'game', 'xp', 'badge', 'day', 'prefs'}


def _id(v, n=200):
    return isinstance(v, str) and len(v) <= n and bool(ID.match(v))


def _int(v, lo, hi):
    return isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi


def check(e, now):
    """None if the event can be applied, else why not. Times are Unix seconds; a time in the future is the device's
    clock running fast, so it is clamped to now (not refused)."""
    if not isinstance(e, dict):
        return 'not an object'
    if not (isinstance(e.get('id'), str) and EVENT_ID.match(e['id'])):
        return 'bad id'
    k = e.get('type')
    if k not in KINDS:
        return 'unknown type'
    if not _int(e.get('at'), EARLIEST, 2 ** 40):
        return 'bad time'
    e['at'] = min(e['at'], now)
    if k in ('step_open', 'step_done'):
        return None if _id(e.get('lesson'), 120) and _id(e.get('step'), 80) else 'bad lesson or step'
    if k == 'answer':
        return None if _id(e.get('question')) and isinstance(e.get('correct'), bool) else 'bad question or correct'
    if k == 'game':
        return None if _id(e.get('game')) and _int(e.get('level'), 0, 100) and _int(e.get('stars'), 0, 3) else 'bad game'
    if k == 'xp':
        return None if _id(e.get('source'), 120) and _int(e.get('amount'), 1, MAX_XP) else 'bad xp'
    if k == 'badge':
        return None if _id(e.get('badge'), 120) else 'bad badge'
    if k == 'day':
        d = e.get('day')
        if not (isinstance(d, str) and DAY.match(d)):
            return 'bad day'
        try:
            date.fromisoformat(d)
        except ValueError:
            return 'bad day'
        return None
    if k == 'prefs':
        given = {f: e[f] for f in PREFS if f in e}
        if not given or any(v not in PREFS[f] for f, v in given.items()):
            return 'bad prefs'
        return None
    return 'unknown type'


# One statement per kind. CASE instead of MIN()/LEAST() so the same SQL runs on SQLite and Postgres.
EARLIER = 'CASE WHEN {t}.{c} IS NULL OR (excluded.{c} IS NOT NULL AND excluded.{c} < {t}.{c}) THEN excluded.{c} ELSE {t}.{c} END'
SQL = {
    'step': 'INSERT INTO step_progress(user_id,lesson_id,step_id,opened_at,done_at) VALUES(?,?,?,?,?) '
            'ON CONFLICT(user_id,lesson_id,step_id) DO UPDATE SET opened_at=%s, done_at=%s'
            % (EARLIER.format(t='step_progress', c='opened_at'), EARLIER.format(t='step_progress', c='done_at')),
    'answer': 'INSERT INTO question_attempts(user_id,question_id,attempts,ever_correct,first_try_correct,first_at,last_at) VALUES(?,?,1,?,?,?,?) '
              'ON CONFLICT(user_id,question_id) DO UPDATE SET attempts=question_attempts.attempts+1, '
              'ever_correct=CASE WHEN excluded.ever_correct=1 THEN 1 ELSE question_attempts.ever_correct END, '
              'first_try_correct=CASE WHEN excluded.first_at < question_attempts.first_at THEN excluded.first_try_correct ELSE question_attempts.first_try_correct END, '
              'first_at=CASE WHEN excluded.first_at < question_attempts.first_at THEN excluded.first_at ELSE question_attempts.first_at END, '
              'last_at=CASE WHEN excluded.last_at > question_attempts.last_at THEN excluded.last_at ELSE question_attempts.last_at END',
    'game': 'INSERT INTO game_scores(user_id,game_id,level,best_stars) VALUES(?,?,?,?) '
            'ON CONFLICT(user_id,game_id,level) DO UPDATE SET best_stars=CASE WHEN excluded.best_stars > game_scores.best_stars THEN excluded.best_stars ELSE game_scores.best_stars END',
    'xp': 'INSERT INTO xp_events(user_id,event_id,source,amount,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,event_id) DO NOTHING',
    'badge': 'INSERT INTO badges(user_id,badge_id,earned_at) VALUES(?,?,?) '
             'ON CONFLICT(user_id,badge_id) DO UPDATE SET earned_at=CASE WHEN excluded.earned_at < badges.earned_at THEN excluded.earned_at ELSE badges.earned_at END',
    'day': 'INSERT INTO activity_days(user_id,day) VALUES(?,?) ON CONFLICT(user_id,day) DO NOTHING',
    'prefs': 'INSERT INTO user_prefs(user_id,lang,theme,motion,reading_mode,updated_at) VALUES(?,?,?,?,?,?) '
             'ON CONFLICT(user_id) DO UPDATE SET lang=COALESCE(excluded.lang,user_prefs.lang), theme=COALESCE(excluded.theme,user_prefs.theme), '
             'motion=COALESCE(excluded.motion,user_prefs.motion), reading_mode=COALESCE(excluded.reading_mode,user_prefs.reading_mode), '
             'updated_at=excluded.updated_at WHERE excluded.updated_at >= user_prefs.updated_at',
}


def _apply(con, uid, e):
    k, at = e['type'], e['at']
    if k in ('step_open', 'step_done'):
        con.execute(SQL['step'], (uid, e['lesson'], e['step'], at, at if k == 'step_done' else None))
    elif k == 'answer':
        ok = 1 if e['correct'] else 0
        con.execute(SQL['answer'], (uid, e['question'], ok, ok, at, at))
    elif k == 'game':
        con.execute(SQL['game'], (uid, e['game'], e['level'], e['stars']))
    elif k == 'xp':
        if con.execute(SQL['xp'], (uid, e['id'], e['source'], e['amount'], at)).rowcount:
            con.execute('UPDATE users SET xp_total=xp_total+? WHERE id=?', (e['amount'], uid))
    elif k == 'badge':
        con.execute(SQL['badge'], (uid, e['badge'], at))
    elif k == 'day':
        con.execute(SQL['day'], (uid, e['day']))
    elif k == 'prefs':
        con.execute(SQL['prefs'], (uid, e.get('lang'), e.get('theme'), e.get('motion'), e.get('reading_mode'), at))


def apply_events(con, uid: int, events: list) -> dict:
    """Applies a batch in one transaction. Returns how many were applied, which ids were already seen (so the device
    can drop them from its outbox too) and which were refused, with why (the device drops those as well: they would
    never be accepted)."""
    now = int(time.time())
    out = {'applied': 0, 'duplicate': [], 'refused': {}}
    for e in events[:MAX_EVENTS]:
        why = check(e, now)
        if why:
            out['refused'][str(e.get('id', '?'))[:64] if isinstance(e, dict) else '?'] = why
            continue
        seen = con.execute('INSERT INTO progress_events(user_id,event_id,kind,received_at) VALUES(?,?,?,?) ON CONFLICT(user_id,event_id) DO NOTHING',
                           (uid, e['id'], e['type'], now)).rowcount
        if not seen:
            out['duplicate'].append(e['id'])
            continue
        _apply(con, uid, e)
        out['applied'] += 1
    return out


def lesson_progress(con, uid: int, lesson_id: str) -> dict:
    """One lesson: its steps, and the questions whose id starts with the lesson id."""
    steps = {r['step_id']: {'opened': r['opened_at'], 'done': r['done_at']}
             for r in con.execute('SELECT step_id,opened_at,done_at FROM step_progress WHERE user_id=? AND lesson_id=?', (uid, lesson_id)).fetchall()}
    like = lesson_id.replace('%', '').replace('_', '\\_') + '/%'
    questions = {r['question_id']: {'attempts': r['attempts'], 'correct': bool(r['ever_correct']), 'first_try': bool(r['first_try_correct'])}
                 for r in con.execute("SELECT question_id,attempts,ever_correct,first_try_correct FROM question_attempts WHERE user_id=? AND question_id LIKE ? ESCAPE '\\'",
                                      (uid, like)).fetchall()}
    games = {}
    for r in con.execute("SELECT game_id,level,best_stars FROM game_scores WHERE user_id=? AND game_id LIKE ? ESCAPE '\\'", (uid, like)).fetchall():
        games.setdefault(r['game_id'], {})[str(r['level'])] = r['best_stars']
    return {'lesson': lesson_id, 'steps': steps, 'questions': questions, 'games': games}


def summary(con, uid: int) -> dict:
    """Totals for the home page: XP, badges, the days the student learned on, and steps opened / done per lesson."""
    xp = con.execute('SELECT xp_total FROM users WHERE id=?', (uid,)).fetchone()
    badges = [r['badge_id'] for r in con.execute('SELECT badge_id FROM badges WHERE user_id=? ORDER BY earned_at', (uid,)).fetchall()]
    days = [r['day'] for r in con.execute('SELECT day FROM activity_days WHERE user_id=? ORDER BY day DESC LIMIT 400', (uid,)).fetchall()]
    lessons = {r['lesson_id']: {'opened': r['o'], 'done': r['d']} for r in con.execute(
        'SELECT lesson_id, COUNT(opened_at) AS o, COUNT(done_at) AS d FROM step_progress WHERE user_id=? GROUP BY lesson_id', (uid,)).fetchall()}
    prefs = con.execute('SELECT lang,theme,motion,reading_mode FROM user_prefs WHERE user_id=?', (uid,)).fetchone()
    return {'xp': int(xp['xp_total']) if xp else 0, 'badges': badges, 'days': days, 'lessons': lessons,
            'prefs': {k: prefs[k] for k in PREFS if prefs[k]} if prefs else {}}
