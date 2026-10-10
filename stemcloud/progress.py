"""Lesson progress v1: a key/value bag per student that only ever moves forward."""
import json, time

from .config import KEY_RE, MAX_KEYS, MAX_VAL
from .db import db


def _json(v, default):
    try:
        return json.loads(v)
    except Exception:
        return default

def _deep_max(a, b):
    """Topic progress only moves forward: counters keep the higher value, flags stay set, nested objects merge key by key."""
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for k, v in b.items():
            out[k] = _deep_max(a[k], v) if k in a else v
        return out
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        return max(a, b)
    return b

def merge(key: str, old, new: str) -> str:
    if old is None:
        return new
    try:
        if key.startswith('scx_topics_'):
            return json.dumps(_deep_max(_json(old, {}), _json(new, {})), ensure_ascii=False, separators=(',', ':'))
        if key == 'scx_xp_total':
            return str(max(int(old), int(new)))
        if key == 'scx_badges' or key.endswith('_activities'):
            return json.dumps(sorted(set(_json(old, [])) | set(_json(new, []))), ensure_ascii=False)
        if key == 'scx_visit_dates':
            return json.dumps(sorted(set(_json(old, [])) | set(_json(new, [])))[-400:])
        if key.endswith('_stars'):
            a, b = _json(old, []), _json(new, [])
            n = max(len(a), len(b)); a += [0] * (n - len(a)); b += [0] * (n - len(b))
            return json.dumps([max(int(x), int(y)) for x, y in zip(a, b)])
        if key.startswith('scx_path_'):
            d = _json(old, {}); d.update({k: v for k, v in _json(new, {}).items() if v}); return json.dumps(d)
        if key.endswith('_done') or key.startswith(('scx_done_', 'scx_story_', 'scx_lab_')):
            return '1' if '1' in (old, new) else new
    except Exception:
        pass
    return new

def load_progress(uid: int, con=None) -> dict:
    if con is None:
        with db() as con:
            return load_progress(uid, con)
    return {r['k']: r['v'] for r in con.execute('SELECT k,v FROM progress WHERE user_id=?', (uid,)).fetchall()}

def save_progress(uid: int, items: dict) -> dict:
    now = int(time.time())
    with db() as con:
        have = {r['k']: r['v'] for r in con.execute('SELECT k,v FROM progress WHERE user_id=?', (uid,)).fetchall()}
        for k, v in items.items():
            if not KEY_RE.match(k) or not isinstance(v, str) or len(v) > MAX_VAL:
                continue
            if k not in have and len(have) >= MAX_KEYS:
                continue
            merged = merge(k, have.get(k), v)
            if have.get(k) == merged:
                continue
            have[k] = merged
            con.execute('INSERT INTO progress(user_id,k,v,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at', (uid, k, merged, now))
    return have
