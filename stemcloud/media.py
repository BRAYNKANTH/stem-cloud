"""R2 media redirects (disabled unless R2_MEDIA_ENABLED=1) and the /static mount that uses them."""
import os, re

from fastapi import HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from api import r2_storage


def media_problems():
    """Names of the R2 settings that stop R2 from working (mirrors r2_storage.settings); never their values."""
    names = ('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_PRIVATE')
    problems = [n + ' is missing' for n in names if not os.environ.get(n, '').strip()]
    account = os.environ.get('R2_ACCOUNT_ID', '').strip()
    if account and not re.fullmatch(r'[a-fA-F0-9]{32}', account):
        problems.append('R2_ACCOUNT_ID is not a 32-character account ID (%d characters)' % len(account))
    return problems


def media_status():
    """How this deployment serves media, for /healthz: 'local', 'r2', or 'r2-incomplete' (switched on but a key or the
    bucket name is missing or invalid). Never includes any setting's value."""
    if not r2_storage.enabled():
        return 'local'
    try:
        r2_storage.settings()
    except ValueError:
        return 'r2-incomplete'
    return 'r2'


def media_response(path):
    try:
        target = r2_storage.asset_target(path)
    except (ValueError, ImportError):
        raise HTTPException(503, 'Media storage is not configured. Please contact the administrator.')
    if target is None:
        return None
    url, visibility = target
    cache = 'public, max-age=3600' if visibility == 'public' else 'private, no-store'
    return RedirectResponse(url, status_code=307, headers={'Cache-Control': cache, 'Referrer-Policy': 'no-referrer'})


class MediaStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        remote = media_response('static/' + path.replace('\\', '/'))
        return remote if remote is not None else await super().get_response(path, scope)
