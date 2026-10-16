"""STEM Cloud backend: the FastAPI app, its middleware and routers."""
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import ON_VERCEL, STATIC, WEB_DIST, WEB_SHELL
from .media import MediaStaticFiles
from .routers import account, admin, auth, feed, lessons, pages, past_papers, progress, progress_v2

app = FastAPI(title='STEM Cloud', docs_url=None, redoc_url=None, openapi_url=None)

# ----------------------------------------------------------------------------- security headers
@app.middleware('http')
async def headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    # lesson pages may be framed by our own topic pages (they show one lesson step inside a topic); nothing else may be framed, and never by another site
    resp.headers['X-Frame-Options'] = 'SAMEORIGIN' if request.url.path.startswith('/lessons/') and request.url.path.endswith('.html') else 'DENY'
    resp.headers['Referrer-Policy'] = 'same-origin'
    if request.url.path.startswith(('/api', '/lessons', '/learn', '/shell/learn', '/past-papers', '/shell/past-papers', '/formulas', '/shell/formulas', '/feed', '/shell/feed', '/topics', '/account', '/admin')):
        if request.url.path not in ('/lessons/past-papers/all.json', '/lessons/past-papers/light.json'):       # that one sets its own (kept on the device, checked in the background)
            resp.headers['Cache-Control'] = 'no-store'
    return resp

for module in (auth, progress, progress_v2, past_papers, feed, account, admin, pages, lessons):
    app.include_router(module.router)


# ----------------------------------------------------------------------------- a page that is not there
@app.exception_handler(StarletteHTTPException)
async def not_found(request: Request, exc: StarletteHTTPException):
    """A browser asking for a page that does not exist gets a page with a way home (web/src/pages/shell/not-found.astro),
    not {"detail": "Not Found"}. The API, and anything else that is not a page, keeps its JSON error."""
    path = request.url.path
    wants_page = 'text/html' in request.headers.get('accept', '') and not path.startswith(('/api/', '/static/', '/_astro/'))
    if exc.status_code == 404 and wants_page:
        built = WEB_SHELL / 'not-found' / 'index.html'
        if built.is_file():
            return HTMLResponse(built.read_text(encoding='utf-8'), status_code=404, headers={'Cache-Control': 'no-cache'})
        return HTMLResponse('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                            '<title>Page not found · STEM Cloud</title><p style="font:18px system-ui;padding:24px">This page is not here. '
                            '<a href="/">Go to STEM Cloud</a></p>', status_code=404)
    return await http_exception_handler(request, exc)

app.mount('/static', MediaStaticFiles(directory=str(STATIC)), name='static')
# Local runs with a web build: the pages this app serves from web/dist (home, /shell/*) need the build's scripts, styles
# and fonts. On Vercel the CDN serves them from the build output.
if not ON_VERCEL and (WEB_DIST / '_astro').is_dir():
    app.mount('/_astro', StaticFiles(directory=str(WEB_DIST / '_astro')), name='astro')
