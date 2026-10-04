# -*- coding: utf-8 -*-
"""Real-browser checks (Edge via Playwright): installability, service worker, offline use, cache privacy, phone layout.

    pip install playwright        (uses the Edge already on Windows; no browser download)
    python tests/test_pwa.py
"""
import json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8766
BASE = 'http://localhost:%d' % PORT
PAGES = ['index', 'intro-physics-is-easy', 'unit-02-motion-in-a-straight-line', 'chapter-04-newtons-laws', 'chapter-05-friction',
         'chapter-09-resultant-force', 'chapter-11-turning-effect', 'chapter-12-equilibrium']
fails = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if not cond else ''))
    if not cond:
        fails.append(name)


MEASURE = '''() => {
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const PADDED = '.badges-btn,.lang-toggle,.tbtn,.stem-av,.stem-menu-btn';      // look 36-40px, hit area is extended to 44px
  const tg = [...document.querySelectorAll('button,summary,select,.navlinks a')].filter(vis).filter(e => !e.closest('.navlinks:not(.stem-open)'));
  const small = tg.filter(e => !e.matches(PADDED) && e.getBoundingClientRect().height < 43).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height));
  [...document.querySelectorAll(PADDED)].filter(vis).forEach(e => { const r = e.getBoundingClientRect(), pad = (44 - r.height) / 2 - 1;
    if (pad > 0) { const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom + pad); if (!(hit === e || e.contains(hit))) small.push('hit-area:' + (e.id || e.className)); } });
  let minPx = 99, n; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (n = w.nextNode()) { const e = n.parentElement; if (!n.textContent.trim() || !e || e.closest('script,style,svg') || !vis(e)) continue; minPx = Math.min(minPx, parseFloat(getComputedStyle(e).fontSize)); }
  return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, small: small, minPx: minPx };
}'''


def run():
    tmp = tempfile.mkdtemp()
    env = dict(os.environ, DB_PATH=os.path.join(tmp, 't.db'))
    for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
        env.pop(k, None)
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(PORT), '--log-level', 'warning'], cwd=os.path.join(ROOT, 'api'), env=env)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1); break
            except Exception:
                time.sleep(0.3)
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='msedge', headless=True)
            ctx = browser.new_context(viewport={'width': 375, 'height': 812}, has_touch=True)
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))

            H = {'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud'}
            r = ctx.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': 'pwatest', 'password': 'LocalTest-9911', 'display_name': 'Pwa'}))
            check('signup for test user', r.ok, r.status)

            # ---- installability (the same check Chrome runs before offering "Install")
            page.goto(BASE + '/login', wait_until='domcontentloaded')
            cdp = ctx.new_cdp_session(page)
            man = cdp.send('Page.getAppManifest')
            check('manifest has no errors', not man.get('errors'), man.get('errors'))
            inst = cdp.send('Page.getInstallabilityErrors')
            errs = [e for e in inst.get('installabilityErrors', []) if e.get('errorId') != 'in-incognito']   # the test browser itself is incognito
            check('Chrome finds no installability errors', not errs, errs)
            data = json.loads(man['data']) if man.get('data') else {}
            check('manifest is standalone with maskable icon', data.get('display') == 'standalone' and any(i.get('purpose') == 'maskable' for i in data.get('icons', [])), data.get('display'))

            # ---- service worker + precache
            page.goto(BASE + '/lessons/index.html', wait_until='domcontentloaded')
            # a page that was open while the worker installed becomes controlled on its next load (normal browser behaviour)
            page.evaluate('navigator.serviceWorker.ready.then(() => true)')
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('navigator.serviceWorker && navigator.serviceWorker.controller', timeout=15000)
            check('service worker controls the page', True)
            keys = page.evaluate('caches.keys()')
            check('static cache created', any(k.startswith('stemcloud-static-') for k in keys), keys)
            cached = page.evaluate("caches.open(%s).then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname))" % json.dumps([k for k in keys if k.startswith('stemcloud-static-')][0]))
            check('offline page + app shell precached', '/static/offline.html' in cached and '/static/app-layer.css' in cached, cached)

            # ---- visit two lessons, then go offline
            page.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded')
            page.wait_for_selector('.stem-av')
            page.goto(BASE + '/lessons/index.html', wait_until='domcontentloaded')
            page.wait_for_timeout(500)
            pk = page.evaluate("caches.keys().then(ks => ks.filter(k => k.startsWith('stemcloud-pages-')))")
            pages_cached = page.evaluate("caches.open(%s).then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname))" % json.dumps(pk[0])) if pk else []
            check('visited lessons are cached', '/lessons/chapter-05-friction.html' in pages_cached and '/lessons/index.html' in pages_cached, pages_cached)

            ctx.set_offline(True)
            page.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded')
            page.wait_for_selector('.stem-av', timeout=10000)
            check('visited lesson opens offline', 'Friction' in page.title())
            page.goto(BASE + '/lessons/chapter-09-resultant-force.html', wait_until='domcontentloaded')
            check('unvisited lesson shows the friendly offline page', 'No internet right now' in page.content())

            # ---- XP earned offline is kept and synced when back online
            page.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded')
            page.wait_for_selector('.stem-av')
            page.evaluate("SCX.addXP(25, 'offline test')")
            page.wait_for_timeout(2500)
            ctx.set_offline(False)
            page.wait_for_function("document.getElementById('acctStatus') === null || true")
            page.evaluate("window.dispatchEvent(new Event('online'))")
            page.wait_for_timeout(3500)
            prog = ctx.request.get(BASE + '/api/progress').json()['progress']
            check('offline XP reached the server after reconnecting', prog.get('scx_xp_total') == '25', prog.get('scx_xp_total'))

            # ---- log out wipes the offline lesson pages (shared-device privacy)
            page.goto(BASE + '/lessons/index.html', wait_until='domcontentloaded')
            page.click('.stem-av')
            page.click('.stem-menu button:has-text("Log out")')
            page.wait_for_url('**/login', timeout=10000)
            page.wait_for_timeout(800)
            left = page.evaluate("caches.keys().then(ks => ks.filter(k => k.startsWith('stemcloud-pages-')))")
            n_left = 0
            for k in left:
                n_left += page.evaluate("caches.open(%s).then(c => c.keys()).then(ks => ks.length)" % json.dumps(k))
            check('logout clears cached lesson pages', n_left == 0, (left, n_left))
            r = ctx.request.post(BASE + '/api/login', headers=H, data=json.dumps({'username': 'pwatest', 'password': 'LocalTest-9911'}))
            check('can log back in', r.ok, r.status)

            # ---- phone layout on every page
            for name in PAGES:
                page.goto(BASE + '/lessons/%s.html' % name, wait_until='domcontentloaded')
                page.wait_for_timeout(900)
                m = page.evaluate(MEASURE)
                check('%s: no sideways scroll at 375px' % name, m['scrollW'] <= m['innerW'], (m['scrollW'], m['innerW']))
                check('%s: buttons are 44px tall' % name, not m['small'], m['small'][:5])
                check('%s: no text under 11px' % name, m['minPx'] >= 11, m['minPx'])

            # ---- animations play even when the phone says "reduce motion" (battery saver / remove animations)
            for reduced in ('reduce', 'no-preference'):
                c2 = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True, reduced_motion=reduced)
                c2.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': 'mot' + reduced[:2], 'password': 'LocalTest-5566'}))
                p2 = c2.new_page(); p2.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded'); p2.wait_for_timeout(1200)
                p2.evaluate("document.getElementById('watch').scrollIntoView({block:'center'})"); p2.mouse.wheel(0, 40); p2.wait_for_timeout(4500)
                prog = int(p2.evaluate("document.getElementById('fw_scrub').value"))
                dur = p2.evaluate("getComputedStyle(document.querySelector('.so-bob')).animationDuration")
                check('Watch-it autoplays with reduce-motion=%s' % reduced, prog > 5, prog)
                check('story animations run with reduce-motion=%s' % reduced, dur == '2.4s', dur)
                c2.close()
            # the in-app switch turns animations off, and the choice is remembered
            c3 = browser.new_context(viewport={'width': 393, 'height': 760}, is_mobile=True, has_touch=True)
            c3.request.post(BASE + '/api/signup', headers=H, data=json.dumps({'username': 'motoff', 'password': 'LocalTest-5566'}))
            p3 = c3.new_page(); p3.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded'); p3.wait_for_selector('.stem-av')
            p3.click('.stem-av'); p3.click('.stem-menu button:has-text("Animations")')
            check('animation switch sets calm mode', p3.evaluate("document.documentElement.classList.contains('stem-calm')"))
            p3.reload(); p3.wait_for_timeout(800)
            check('calm mode is remembered after reload', p3.evaluate("document.documentElement.classList.contains('stem-calm')"))
            p3.evaluate("document.getElementById('watch').scrollIntoView({block:'center'})"); p3.mouse.wheel(0, 40); p3.wait_for_timeout(3000)
            check('calm mode stops autoplay', int(p3.evaluate("document.getElementById('fw_scrub').value")) == 0)
            c3.close()

            # ---- phone menu + account menu open
            page.goto(BASE + '/lessons/chapter-05-friction.html', wait_until='domcontentloaded')
            page.wait_for_selector('.stem-menu-btn')
            page.click('.stem-menu-btn')
            check('section menu opens', page.evaluate("document.querySelector('.navlinks').classList.contains('stem-open')"))
            page.click('.navlinks a[href="#quiz"]')
            check('section menu closes after choosing', not page.evaluate("document.querySelector('.navlinks').classList.contains('stem-open')"))
            page.click('.stem-av')
            check('account menu shows name and links', page.is_visible('.stem-menu a[href="/account"]'))
            check('no script errors', not errors, errors[:3])
            browser.close()
    finally:
        srv.terminate()
        try:
            srv.wait(8)
        except Exception:
            srv.kill()


if __name__ == '__main__':
    run()
    print('\n%s' % ('ALL PASSED' if not fails else 'FAILED: ' + ', '.join(fails)))
    sys.exit(1 if fails else 0)
