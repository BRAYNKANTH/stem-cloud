# -*- coding: utf-8 -*-
"""Interface rules, checked on the rendered pages (computed styles), on desktop and phone, in dark and light.

    python tests/test_ui.py
The rules (see public/static/ui.css): no gradients, shadows, blur or glow; no glowing orbs or dot grids; small corners (circles allowed);
no coloured left stripes; no Inter / Geist / Space Grotesk; no emoji in the app's own screens; one accent, no purple or neon;
no pure white page or card; a Terms and a Privacy page; skeleton placeholders while the topic page loads.
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.request

from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_topics as T          # reuses the server/browser helpers

fails = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  ' + str(extra)[:600]) if not cond else ''))
    if not cond:
        fails.append(name)


SCAN = r'''() => {
  const out = {gradient: [], shadow: [], blur: [], radius: [], stripe: [], font: [], white: [], purple: [], pseudo: [], cards: []};
  const EMO = /[\u{1F300}-\u{1FAFF}☀-➿⭐✅]/u;
  const label = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const isWhite = c => /^rgba?\(255, 255, 255(, 1)?\)$/.test(c);
  for (const e of document.querySelectorAll('body, body *')) {
    if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    if (e.closest('#tp-iframe, iframe, #fw_svg, #ls_svg, .so-scene')) continue;
    if (!vis(e)) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (/gradient/.test(cs.backgroundImage)) out.gradient.push(label(e));
    if (cs.boxShadow !== 'none') out.shadow.push(label(e));
    if ((cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')) out.blur.push(label(e));
    const rad = cs.borderTopLeftRadius;
    if (rad && !rad.includes('%')) {
      const px = parseFloat(rad);
      const round = Math.abs(r.width - r.height) < 3 && px >= Math.min(r.width, r.height) / 2 - 1;
      const bar = px >= Math.min(r.width, r.height) / 2 - 1 && Math.min(r.width, r.height) <= 12;   // tracks and dots
      if (px > 8.5 && !round && !bar) out.radius.push(label(e) + ':' + px);
    }
    if (parseFloat(cs.borderLeftWidth) >= 3 && cs.borderLeftStyle === 'solid' && cs.borderLeftColor !== 'rgba(0, 0, 0, 0)' && parseFloat(cs.borderRightWidth) < 2 && r.width > 8) out.stripe.push(label(e));
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (/^(Inter|Geist|Space Grotesk)$/i.test(fam)) out.font.push(label(e) + ':' + fam);
    if (isWhite(cs.backgroundColor) && r.width > 120 && r.height > 24) out.white.push(label(e));
    const m = cs.backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)/);
    if (m) { const R = +m[1], G = +m[2], B = +m[3]; if (R > 90 && B > 150 && G < R - 20 && B > R + 20 && R > G + 20) out.purple.push(label(e) + ':' + cs.backgroundColor); }
  }
  for (const sel of ['::before', '::after']) { const cs = getComputedStyle(document.body, sel); if (cs.content !== 'none' && cs.content !== 'normal' && cs.display !== 'none') out.pseudo.push('body' + sel); }
  out.cards = [];
  for (const g of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(g);
    if (cs.display !== 'grid' || !vis(g)) continue;
    const cols = cs.gridTemplateColumns.split(' ').filter(x => x && x !== 'none').length;
    if (cols < 3) continue;
    const kids = [...g.children].filter(vis);
    const boxed = kids.filter(k => { const c = getComputedStyle(k); return parseFloat(c.borderTopWidth) > 0 || (c.backgroundColor !== 'rgba(0, 0, 0, 0)'); });
    if (boxed.length >= 3 && !g.closest('footer, .footer-grid') && !/footer/.test(g.className)) out.cards.push(label(g) + ':' + cols + ' columns');
  }
  out.emoji = [];
  const roots = document.querySelectorAll('.topbar, #stem-bar, .stem-ov, #toc, .course, #app, main, .wrap > header, body[data-ui-skin-all]');
  for (const root of roots) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest('script,style,svg,iframe,.exq,.ex-answer,.tp-notes,.tp-lesson,.qtext') || !vis(p)) continue;
      if (EMO.test(n.nodeValue)) out.emoji.push(label(p) + ':' + n.nodeValue.trim().slice(0, 30));
    }
  }
  return out;
}'''


def scan(page, name, allow=()):
    r = page.evaluate(SCAN)
    for k in ('gradient', 'shadow', 'blur', 'radius', 'stripe', 'font', 'white', 'purple', 'pseudo', 'emoji', 'cards'):
        bad = [x for x in r[k] if not any(a in x for a in allow)]
        check('%s: no %s' % (name, {'gradient': 'gradients', 'shadow': 'drop shadows or glows', 'blur': 'glass blur', 'radius': 'soft corners', 'stripe': 'coloured left stripes',
                                    'font': 'Inter/Geist/Space Grotesk', 'white': 'pure white panels', 'purple': 'purple fills', 'pseudo': 'orb or dot-grid backdrop', 'emoji': 'emoji in the screens', 'cards': 'three or more cards across'}[k]), not bad, sorted(set(bad))[:8])


def run():
    tmp = tempfile.mkdtemp()
    env = dict(os.environ, DB_PATH=os.path.join(tmp, 't.db'))
    for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
        env.pop(k, None)
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(T.PORT), '--log-level', 'warning'], cwd=os.path.join(T.ROOT, 'api'), env=env)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(T.BASE + '/healthz', timeout=1); break
            except Exception:
                time.sleep(0.3)
        with sync_playwright() as p:
            b = T.launch(p)
            adm = b.new_context()
            adm.request.post(T.BASE + '/api/signup', headers=T.H, data=json.dumps({'username': 'adm_root', 'password': 'LocalTest-2468'}))
            n = [0]

            def student(size, scheme):
                n[0] += 1
                name = 'ui_%d' % n[0]
                adm.request.post(T.BASE + '/api/admin/create-user', headers=T.H, data=json.dumps({'username': name, 'password': 'LocalTest-2468'}))
                ctx = b.new_context(viewport=size, has_touch=size['width'] < 600, color_scheme=scheme)
                ctx.add_init_script("try{localStorage.setItem('stem_coach_done','1')}catch(e){}")
                return ctx, name

            for label, size, scheme in (('desktop dark', {'width': 1100, 'height': 900}, 'dark'), ('phone light', {'width': 390, 'height': 800}, 'light'), ('phone dark', {'width': 390, 'height': 800}, 'dark')):
                ctx, user = student(size, scheme)
                page = ctx.new_page()
                page.goto(T.BASE + '/login'); page.wait_for_timeout(1200)
                scan(page, label + ' login')
                for nm, path in (('home', '/'), ('about', '/about')):
                    page.goto(T.BASE + path); page.wait_for_timeout(1500)
                    scan(page, '%s %s' % (label, nm), allow=('stem-coach',))
                    over = page.evaluate('() => document.documentElement.scrollWidth - innerWidth')
                    check('%s %s fits the screen width' % (label, nm), over <= 1, over)
                for path in ('/terms', '/privacy'):
                    page.goto(T.BASE + path); page.wait_for_timeout(500)
                    check('%s %s page opens' % (label, path), 'Terms' in page.content() or 'What we keep' in page.content())
                assert ctx.request.post(T.BASE + '/api/login', headers=T.H, data=json.dumps({'username': user, 'password': 'LocalTest-2468'})).ok
                for nm, path, wait in (('contents', '/lessons/index.html', 1500), ('chapter overview', T.PAGE, 1500),
                                       ('topic step', T.PAGE + '?t=distance-displacement&s=understand', 1500), ('practice', T.PAGE + '?t=acceleration&s=practice', 1500),
                                       ('lesson start', '/lessons/unit-02-motion-in-a-straight-line.html', 2500), ('lesson step', '/lessons/unit-02-motion-in-a-straight-line.html#notes', 2500),
                                       ('account', '/account', 800)):
                    page.goto(T.BASE + path); page.wait_for_timeout(wait)
                    scan(page, '%s %s' % (label, nm), allow=('stem-coach',))
                ctx.close()

            # type: the families that were asked for
            ctx, user = student({'width': 1100, 'height': 900}, 'dark')
            page = ctx.new_page()
            ctx.request.post(T.BASE + '/api/login', headers=T.H, data=json.dumps({'username': user, 'password': 'LocalTest-2468'}))
            page.goto(T.BASE + T.PAGE); page.wait_for_selector('#tp-h1', state='attached'); page.wait_for_timeout(800)
            fams = page.evaluate("() => [getComputedStyle(document.body).fontFamily, getComputedStyle(document.querySelector('h1')).fontFamily]")
            check('text is Source Sans 3 and headings are Source Serif 4', 'Source Sans 3' in fams[0] and 'Source Serif 4' in fams[1], fams)
            check('Tamil and Sinhala fonts stay in the stack', 'Noto Sans Tamil' in fams[0] and 'Noto Sans Sinhala' in fams[0], fams)
            check('the page colour is not pure white or black', page.evaluate("() => getComputedStyle(document.body).backgroundColor") not in ('rgb(255, 255, 255)', 'rgb(0, 0, 0)'))
            # hovering moves nothing
            page.goto(T.BASE + T.PAGE); page.wait_for_selector('.tp-topic')
            box = page.locator('.tp-tlink').first
            before = box.bounding_box()
            box.hover(); page.wait_for_timeout(300)
            after = box.bounding_box()
            check('hover does not move or resize cards', before == after, (before, after))
            # skeleton placeholders while the chapter loads
            slow = ctx.new_page()
            slow.add_init_script("const f = window.fetch.bind(window); window.fetch = (u, ...a) => /\\/topics\\/[a-z0-9-]+\\.json/.test(String(u)) ? new Promise(r => setTimeout(r, 1800)).then(() => f(u, ...a)) : f(u, ...a);")
            slow.goto(T.BASE + T.PAGE, wait_until='commit')
            slow.wait_for_selector('.skel', state='attached', timeout=5000)
            check('a placeholder in the shape of the page shows while it loads', slow.locator('.tp-skeleton .skel').count() >= 3 and 'Loading' not in slow.locator('#app').inner_text())
            slow.wait_for_selector('.tp-topics', timeout=15000)
            ctx.close(); b.close()
    finally:
        srv.terminate()
    print('\n%d check(s) failed' % len(fails) if fails else '\nall checks passed')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(run())
