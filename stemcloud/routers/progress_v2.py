"""Progress v2 API (stemcloud/progress_v2.py): the new lesson pages send events and read summaries."""
from fastapi import APIRouter, HTTPException, Request

from ..db import db
from ..progress_v2 import ID, MAX_EVENTS, apply_events, lesson_progress, summary
from ..security import body_json, need_csrf, need_user

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
