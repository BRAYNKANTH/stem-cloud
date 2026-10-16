"""The learning feed (web/src/pages/shell/feed): a swiped feed of short cards (predict, then watch; true or false; a quick
question; a formula). Separate from the rest of the app while it is tried out: nothing links to it yet.

A student's first answer to a card is kept (feed_answers), and every answer returns how all students answered that card,
so the card can show "62% chose B". The cards are content/feed/physics.json."""
import json, time
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from ..config import FEED_CARDS, PRACTICE, WEB_FEED
from ..db import db
from ..security import body_json, current_user_gate, need_csrf, need_user

router = APIRouter()


@lru_cache(maxsize=1)
def cards() -> dict:
    """The answerable cards by id: how many choices each has and which is right (true / false is two choices). The feed's
    own cards, and every chapter's practice questions (content/practice/<subject>/<chapter>.json)."""
    out = {}
    for c in json.loads(FEED_CARDS.read_text(encoding='utf-8'))['cards']:
        if c['type'] in ('predict', 'mcq'):
            out[c['id']] = (len(c['options']), c['correct'])
        elif c['type'] == 'tf':
            out[c['id']] = (2, c['correct'])
    for pool in sorted(PRACTICE.glob('*/*.json')):
        for q in json.loads(pool.read_text(encoding='utf-8'))['questions']:
            out[q['id']] = (len(q['options']) if q['type'] == 'mcq' else 2, q['correct'])
    return out


def counts(con, card: str, n: int) -> list[int]:
    """How many students chose each option of a card."""
    got = {r['choice']: r['n'] for r in con.execute('SELECT choice, COUNT(*) AS n FROM feed_answers WHERE card_id=? GROUP BY choice', (card,)).fetchall()}
    return [int(got.get(i, 0)) for i in range(n)]


@router.get('/feed')
@router.get('/feed/')
def feed_page(req: Request):
    """Signed-in students only, like the lessons; kept out of the published files by the build (web/scripts/private.mjs)."""
    if not current_user_gate(req):
        return RedirectResponse('/login?next=/feed/', status_code=302)
    if WEB_FEED.is_file():
        return FileResponse(WEB_FEED, media_type='text/html')
    raise HTTPException(404, 'Not found.')


@router.post('/api/feed/answer')
async def feed_answer(req: Request):
    """{"card": id, "choice": n}. The first answer of a student to a card is kept; a later one is not counted again.
    Returns {"correct": n, "first": bool, "counts": [...]}: the right choice, and how everyone answered."""
    need_csrf(req)
    u = need_user(req)
    d = body_json(await req.json())
    card, choice = d.get('card'), d.get('choice')
    known = cards()
    if not isinstance(card, str) or card not in known:
        raise HTTPException(400, 'Unknown card.')
    n, right = known[card]
    if type(choice) is not int or choice not in range(n):
        raise HTTPException(400, 'Choose one of the options.')
    with db() as con:
        before = con.execute('SELECT 1 FROM feed_answers WHERE user_id=? AND card_id=?', (u['id'], card)).fetchone()
        if not before:
            con.execute('INSERT INTO feed_answers(user_id,card_id,choice,correct,answered_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,card_id) DO NOTHING',
                        (u['id'], card, choice, int(choice == right), int(time.time())))
        return {'correct': right, 'first': not before, 'counts': counts(con, card, n)}
