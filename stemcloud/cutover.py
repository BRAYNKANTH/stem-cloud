"""The cut-over (docs/migration-plan-astro.md, Phase 9): the current lesson and topic pages send students to the new ones.

Switched by the CUTOVER setting, so the owner turns it on (and back off) without a deploy of new code:
  - unset or "off": nothing changes (the current pages are served as now);
  - "trial": temporary redirects (302), which browsers do not remember, for a trial with real students;
  - "on": permanent redirects (301), the plan's cut-over; browsers remember them.
What goes where comes from stemcloud/legacy_map.json (tools/legacy_map.py, from content/):
  /lessons/<page>.html          -> /learn/<subject>/g<grade>/<lesson>/   (the #section stays: the new page reads the
                                   current pages' section ids, LessonShell's aliases)
  /topics/<page>                -> /learn/<subject>/g<grade>/<lesson>/topics/
  /lessons/past-papers.html     -> /past-papers/
A page shown inside a frame (?embed=1) is left alone, so a frame in an app that has not updated yet still works.
"""
import json
import os
from pathlib import Path

from fastapi.responses import RedirectResponse

MAP = json.loads(Path(__file__).with_name('legacy_map.json').read_text(encoding='utf-8'))
LESSON_URL = {v['file']: v['url'] for v in MAP.values() if v.get('file') and v.get('url')}
LESSON_URL['past-papers.html'] = '/past-papers/'
TOPICS_URL = {f[:-len('.html')]: u + 'topics/' for f, u in LESSON_URL.items() if u.startswith('/learn/')}


def mode() -> str:
    m = os.environ.get('CUTOVER', '').strip().lower()
    return m if m in ('trial', 'on') else 'off'


def _redirect(url: str):
    return RedirectResponse(url, status_code=301 if mode() == 'on' else 302)


def lesson_page(rel: str, query: dict):
    """The redirect for a current lesson page (/lessons/<rel>), or None to serve it as now."""
    if mode() == 'off' or query.get('embed') or rel not in LESSON_URL:
        return None
    return _redirect(LESSON_URL[rel])


def topics_page(slug: str, query: dict):
    """The redirect for a current topic page (/topics/<slug>), or None to serve it as now."""
    if mode() == 'off' or query.get('embed') or slug not in TOPICS_URL:
        return None
    return _redirect(TOPICS_URL[slug])
