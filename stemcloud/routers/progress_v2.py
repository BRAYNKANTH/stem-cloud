"""Progress v2 API (stemcloud/progress_v2.py): the new lesson pages send events and read summaries."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..db import db
from ..progress_v2 import ID, MAX_EVENTS, apply_events, lesson_progress, summary
from ..security import body_json, current_user, need_csrf, need_user, public, set_gate

router = APIRouter()


@router.post('/api/v2/events')
async def api_events(req: Request):
    """A batch of events from a device's outbox: {"events": [...]}, at most MAX_EVENTS. Replaying a batch is harmless."""
    need_csrf(req)
    u = need_user(req)
    d = body_json(await req.json())
    events = d.get('events')
    if not isinstance(events, list) or len(events) > MAX_EVENTS:
        raise HTTPException(400, 'Send up to %d events.' % MAX_EVENTS)
    with db() as con:
        return apply_events(con, u['id'], events)


@router.get('/api/v2/start')
def api_start(req: Request, lesson: str = ''):
    """What a page asks for when it opens: who is signed in, the XP summary and, when a lesson is named, that lesson's
    progress: in one request and one database connection (a page used to make three requests, one after another).
    401 when nobody is signed in, like /api/me."""
    if lesson and not (len(lesson) <= 120 and ID.match(lesson)):
        raise HTTPException(400, 'Bad lesson id.')
    with db() as con:
        u = current_user(req, con)
        if not u:
            raise HTTPException(401, 'Please log in.')
        out = {'user': public(u), 'summary': summary(con, u['id'])}
        if lesson:
            out['lesson'] = lesson_progress(con, u['id'], lesson)
    resp = JSONResponse(out)
    set_gate(resp, u['id'], req)          # like /api/me: keeps the 24-hour lesson gate fresh
    return resp


@router.get('/api/v2/progress')
def api_lesson_progress(req: Request, lesson: str = ''):
    u = need_user(req)
    if not (len(lesson) <= 120 and ID.match(lesson)):
        raise HTTPException(400, 'Bad lesson id.')
    with db() as con:
        return lesson_progress(con, u['id'], lesson)


@router.get('/api/v2/progress/summary')
def api_summary(req: Request):
    u = need_user(req)
    with db() as con:
        return summary(con, u['id'])
