"""The lesson pages (login only): the new ones built from content/ (/learn/...), and the current lesson and topic pages,
served with the student's progress."""
import json, re
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from .. import cutover
from ..config import LESSONS, ROOT, WEB_LEARN
from ..db import db
from ..legacy import render_lesson
from ..media import media_response
from ..progress import load_progress
from ..security import current_user, current_user_gate

router = APIRouter()

SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]{0,80}$')
GRADE_RE = re.compile(r'^g[0-9]{1,2}$')
CATALOG = ROOT / 'content' / 'catalog.json'


def legacy_page(subject: str, grade: str, chapter: str) -> str | None:
    """The current lesson page of a chapter, from content/catalog.json (local runs without a web build)."""
    try:
        catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    for l in catalog.get('lessons', []):
        if (l['subject'], 'g%d' % l['grade'], l['slug']) == (subject, grade, chapter) and l.get('legacy'):
            return '/lessons/' + l['legacy']['file']
    return None


def learn(req: Request, subject: str, grade: str, chapter: str, *topic: str):
    """A page built from content/ (web/src/pages/shell/learn/): the lesson, or its topic view (topics/, topics/<topic>/).
    Signed-in students only, like the current lessons. The build moves these pages out of the published files
    (web/scripts/private.mjs) into web/dist-private/learn/, which is bundled with the function only, so the CDN has no
    copy to serve; vercel.json also sends the build's own path (/shell/learn/*) here. Without a build (local runs), the
    chapter's current lesson page."""
    if not (SLUG_RE.match(subject) and GRADE_RE.match(grade) and SLUG_RE.match(chapter) and all(SLUG_RE.match(t) for t in topic)):
        raise HTTPException(404, 'Not found.')
    rel = '/'.join((subject, grade, chapter) + topic)
    if not current_user_gate(req):
        return RedirectResponse('/login?next=' + quote('/learn/%s/' % rel, safe='/'), status_code=302)
    built = WEB_LEARN.joinpath(*rel.split('/'), 'index.html')
    if built.is_file():
        return FileResponse(built, media_type='text/html')
    if not WEB_LEARN.is_dir():
        old = legacy_page(subject, grade, chapter)
        if old:
            return RedirectResponse(old, status_code=302)
    raise HTTPException(404, 'Not found.')


@router.get('/learn/{subject}/{grade}/{chapter}')
@router.get('/learn/{subject}/{grade}/{chapter}/')
def learn_page(subject: str, grade: str, chapter: str, req: Request):
    return learn(req, subject, grade, chapter)


@router.get('/learn/{subject}/{grade}/{chapter}/topics')
@router.get('/learn/{subject}/{grade}/{chapter}/topics/')
def learn_topics(subject: str, grade: str, chapter: str, req: Request):
    return learn(req, subject, grade, chapter, 'topics')


@router.get('/learn/{subject}/{grade}/{chapter}/topics/{topic}')
@router.get('/learn/{subject}/{grade}/{chapter}/topics/{topic}/')
def learn_topic(subject: str, grade: str, chapter: str, topic: str, req: Request):
    return learn(req, subject, grade, chapter, 'topics', topic)


@router.get('/shell/learn/{rest:path}')
def built_lesson_path(rest: str):
    """The build's own path of a lesson: always through the sign-in check above."""
    return RedirectResponse('/learn/' + quote(rest.strip('/'), safe='/') + '/', status_code=302)

@router.get('/topics/{slug}')
def topics_page(slug: str, req: Request):
    """Subject > chapter > topic > learning steps. The page is one shell; the chapter's content is site/lessons/topics/<slug>.json (served to logged-in students only)."""
    moved = cutover.topics_page(slug, dict(req.query_params))
    if moved is not None:
        return moved
    if not SLUG_RE.match(slug) or not (LESSONS / 'topics' / (slug + '.json')).is_file():
        raise HTTPException(404, 'Not found.')
    with db() as con:
        u = current_user(req, con)
        if not u:
            nxt = req.url.path + ('?' + req.url.query if req.url.query else '')
            return RedirectResponse('/login?next=' + quote(nxt, safe='/'), status_code=302)
        return render_lesson(LESSONS / 'topics.html', u, load_progress(u['id'], con))

@router.get('/lessons')
@router.get('/lessons/')
def lessons_root():
    return RedirectResponse('/lessons/index.html', status_code=302)

@router.get('/learn')
@router.get('/learn/')
@router.get('/learn/{subject}')
@router.get('/learn/{subject}/')
@router.get('/learn/{subject}/{grade}')
@router.get('/learn/{subject}/{grade}/')
def learn_root(subject: str = '', grade: str = ''):
    """A shortened lesson address (/learn/, /learn/physics/g10/) opens the chapter list, the course home."""
    return RedirectResponse('/lessons/index.html', status_code=302)

@router.get('/lessons/{rel:path}')
def lessons(rel: str, req: Request):
    moved = cutover.lesson_page(rel, dict(req.query_params))     # the cut-over: the new lesson page (CUTOVER setting)
    if moved is not None:
        return moved
    p = (LESSONS / rel).resolve()
    with db() as con:                    # one database connection for the whole page: session check and the student's progress
        u = current_user(req, con)
        if not u:
            if rel.endswith('.html'):
                return RedirectResponse('/login?next=' + '/lessons/' + rel, status_code=302)
            raise HTTPException(401, 'Please log in.')
        if LESSONS not in p.parents:
            raise HTTPException(404, 'Not found.')
        remote = media_response('lessons/' + p.relative_to(LESSONS).as_posix())
        if remote is not None:
            return remote
        if not p.is_file():
            raise HTTPException(404, 'Not found.')
        if p.suffix == '.html':
            return render_lesson(p, u, load_progress(u['id'], con))
    return FileResponse(p)
