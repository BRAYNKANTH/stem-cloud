"""Past papers: attempts and bookmarks, kept separate from lesson XP and progress."""
import gzip, hashlib, json, re, time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response

from ..config import PAST_PAPERS, WEB_FORMULAS, WEB_PAPERS
from ..db import db
from ..security import body_json, current_user_gate, need_csrf, need_user

router = APIRouter()


@router.get('/past-papers')
@router.get('/past-papers/')
def past_papers_page(req: Request):
    """The new past papers page (web/src/pages/shell/past-papers): signed-in students only, like the current one. It is
    kept out of the published files by the build and served from here; without a build, the current page."""
    if not current_user_gate(req):
        return RedirectResponse('/login?next=/past-papers/', status_code=302)
    if WEB_PAPERS.is_file():
        return FileResponse(WEB_PAPERS, media_type='text/html')
    return RedirectResponse('/lessons/past-papers.html', status_code=302)


@router.get('/formulas')
@router.get('/formulas/')
def formula_cards_page(req: Request):
    """The formula cards (web/src/pages/shell/formulas): signed-in students only, like the lessons they come from. Kept
    out of the published files by the build (web/scripts/private.mjs) and served from here."""
    if not current_user_gate(req):
        return RedirectResponse('/login?next=/formulas/', status_code=302)
    if WEB_FORMULAS.is_file():
        return FileResponse(WEB_FORMULAS, media_type='text/html')
    raise HTTPException(404, 'Not found.')


def past_questions():
    questions = {}
    for year in range(2015, 2024):
        path = PAST_PAPERS / f'{year}.json'
        if not path.exists():
            continue
        bank = json.loads(path.read_text(encoding='utf-8'))
        if bank.get('scope') != 'physics':
            continue
        questions.update({q['id']: q for q in bank['questions'] if q['subjects'] == ['physics']})
    return questions


_ALL = {}


def all_physics():
    """The catalog and every physics bank in one body, packed once per server instance: (plain bytes, gzip bytes, version).
    The new Past papers page used to fetch the catalog and nine banks one by one (eleven requests, each checking the sign-in
    with its own database connection); now it is one request, and the browser asks again only with the version (a 304)."""
    if not _ALL:
        cat = json.loads((PAST_PAPERS / 'catalog.json').read_text(encoding='utf-8'))
        banks = {}
        for p in cat['papers']:
            if p.get('bank') and p.get('scope') == 'physics':
                banks[str(p['year'])] = json.loads((PAST_PAPERS / (str(p['year']) + '.json')).read_text(encoding='utf-8'))
        plain = json.dumps({'catalog': cat, 'banks': banks}, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        _ALL['all'] = (plain, gzip.compress(plain, 5), hashlib.sha1(plain).hexdigest()[:16])
    return _ALL['all']


@router.get('/lessons/past-papers/{name}.json')
def past_paper_bank(name: str, req: Request):
    """A year's question bank or the catalog, from content/past-papers/physics (the address the pages already use), or
    "all": the catalog and every bank in one go. Signed-in students only, like the rest of /lessons."""
    if not (name in ('catalog', 'all') or (name.isdigit() and len(name) == 4)):
        raise HTTPException(404, 'Not found.')
    if not current_user_gate(req):
        raise HTTPException(401, 'Please log in.')
    if name == 'all':
        plain, packed, ver = all_physics()
        # shown from the device for two minutes, then at once from the device while it checks again in the background (the
        # banks change only when their explanations are improved); the check is a 304 when nothing changed
        head = {'ETag': '"%s"' % ver, 'Cache-Control': 'private, max-age=120, stale-while-revalidate=604800', 'Vary': 'Accept-Encoding, Cookie'}
        if req.headers.get('if-none-match') == head['ETag']:
            return Response(status_code=304, headers=head)
        if 'gzip' in req.headers.get('accept-encoding', ''):
            return Response(packed, media_type='application/json', headers={**head, 'Content-Encoding': 'gzip'})
        return Response(plain, media_type='application/json', headers=head)
    path = PAST_PAPERS / (name + '.json')
    if not path.is_file():
        raise HTTPException(404, 'Not found.')
    # the banks change as their explanations are improved: browsers must check (a cheap 304 when unchanged)
    return FileResponse(path, media_type='application/json', headers={'Cache-Control': 'no-cache'})


@router.get('/api/past-papers/state')
def past_state(req: Request):
    u = need_user(req)
    with db() as con:
        rows = con.execute('SELECT event_id,question_id,result,created_at FROM past_attempts WHERE user_id=? '
                           'ORDER BY created_at,event_id', (u['id'],)).fetchall()
        bookmarks = [r['question_id'] for r in con.execute('SELECT question_id FROM past_bookmarks WHERE user_id=?', (u['id'],)).fetchall()]
    bank = past_questions()
    attempts = []
    for r in rows:
        q = bank.get(r['question_id'])
        if not q:
            continue
        result = json.loads(r['result'])
        if q['type'] == 'written':
            labels = {p['label'] for p in q['parts']}
            result['answers'] = {k:v for k,v in result.get('answers', {}).items() if k in labels}
        attempts.append(dict(id=r['event_id'], question=r['question_id'], result=result, at=r['created_at']))
    return {'attempts': attempts, 'bookmarks': [q for q in bookmarks if q in bank]}


@router.post('/api/past-papers/attempts')
async def past_save(req: Request):
    need_csrf(req); u = need_user(req)
    raw = await req.body()
    if len(raw) > 512000:
        raise HTTPException(413, 'Attempt is too large.')
    try:
        data = body_json(json.loads(raw))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, 'Invalid JSON.')
    events = data.get('events')
    if not isinstance(events, list) or not 1 <= len(events) <= 50:
        raise HTTPException(400, 'Send between 1 and 50 attempts.')
    bank = past_questions(); validated = []
    for e in events:
        if not isinstance(e, dict) or not isinstance(e.get('id'), str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,64}', e['id']):
            raise HTTPException(400, 'Invalid attempt ID.')
        q = bank.get(e.get('question')) if isinstance(e.get('question'), str) else None
        if not q or e.get('mode') not in ('practice','exam'):
            raise HTTPException(400, 'Unknown question or mode.')
        clean = {k:e[k] for k in ('id','question','mode')}
        if q['type'] == 'mcq':
            choice = e.get('choice')
            if choice is not None and (type(choice) is not int or choice not in range(4)):
                raise HTTPException(400, 'Choose an option from 1 to 4.')
            clean['choice'] = choice
            result = dict(type='mcq', choice=choice, correct=choice == q['correct'], correctChoice=q['correct'], mode=e['mode'])
        else:
            answers = e.get('answers', {})
            labels = {p['label'] for p in q['parts']}
            if (not isinstance(answers,dict) or any(k not in labels or not isinstance(v,str) or len(v)>2000 for k,v in answers.items())
                    or e.get('selfCheck') not in (None,'needs-work','understood')):
                raise HTTPException(400, 'Invalid written response.')
            clean.update(answers=answers, selfCheck=e.get('selfCheck'))
            result = dict(type='written', answers=answers, selfCheck=e.get('selfCheck'), mode=e['mode'])
        validated.append((clean,result))
    saved=[]; now=int(time.time()*1000)
    with db() as con:
        last=con.execute('SELECT MAX(created_at) AS at FROM past_attempts WHERE user_id=?',(u['id'],)).fetchone()['at']
        now=max(now,(last or 0)+1)
        for clean,result in validated:
            payload=json.dumps(clean,sort_keys=True,ensure_ascii=False)
            old=con.execute('SELECT payload,result,created_at FROM past_attempts WHERE user_id=? AND event_id=?',(u['id'],clean['id'])).fetchone()
            if old and old['payload'] != payload:
                raise HTTPException(409, 'Attempt ID was already used. Retry with the original response.')
            con.execute('INSERT INTO past_attempts(user_id,event_id,question_id,payload,result,created_at) VALUES(?,?,?,?,?,?) '
                        'ON CONFLICT(user_id,event_id) DO NOTHING',
                        (u['id'],clean['id'],clean['question'],payload,json.dumps(result,ensure_ascii=False),now))
            stored=con.execute('SELECT payload,result,created_at FROM past_attempts WHERE user_id=? AND event_id=?',(u['id'],clean['id'])).fetchone()
            if stored['payload']!=payload:
                raise HTTPException(409, 'Attempt ID was already used.')
            saved.append(dict(id=clean['id'],question=clean['question'],result=json.loads(stored['result']),at=stored['created_at']))
            now+=1
    return {'attempts':saved}


@router.put('/api/past-papers/bookmark')
async def past_bookmark(req: Request):
    need_csrf(req); u=need_user(req); d=body_json(await req.json())
    q=d.get('question')
    if not isinstance(q,str) or q not in past_questions() or type(d.get('saved')) is not bool:
        raise HTTPException(400, 'Invalid bookmark.')
    with db() as con:
        if d['saved']:
            con.execute('INSERT INTO past_bookmarks(user_id,question_id) VALUES(?,?) ON CONFLICT(user_id,question_id) DO NOTHING',(u['id'],q))
        else:
            con.execute('DELETE FROM past_bookmarks WHERE user_id=? AND question_id=?',(u['id'],q))
    return {'ok':True}
