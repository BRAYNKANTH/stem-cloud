# -*- coding: utf-8 -*-
"""Lighthouse performance snapshot of the app, run locally so the old and new app can be compared the same way.

    python tools/perf_baseline.py                 # writes docs/perf/<date>-<label>.md (+ raw JSON in docs/perf/raw/)
    python tools/perf_baseline.py --label astro   # name the snapshot

Starts the API on a throwaway SQLite database, signs up a local test student, and runs Lighthouse
(mobile, simulated slow 4G, 4x CPU slowdown) on the public pages and on logged-in lesson pages.
Needs Node (npx) and Chrome or Edge. Local numbers leave out CDN and network distance: use them to compare runs, not as field data.
"""
import argparse, datetime, http.cookiejar, json, os, secrets, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8790
BASE = 'http://127.0.0.1:%d' % PORT
LIGHTHOUSE = 'lighthouse@13.4.1'
PAGES = [
    ('Home (public)', '/home', False),
    ('Login', '/login', False),
    ('Course contents', '/lessons/index.html', True),
    ('Lesson: Friction', '/lessons/chapter-05-friction.html', True),
    ('Lesson: Geometrical optics (largest)', '/lessons/g11-chapter-05-geometrical-optics.html', True),
    ('Topic view: Motion', '/topics/unit-02-motion-in-a-straight-line', True),
]
CATS = ['performance', 'accessibility', 'best-practices']
AUDITS = [('first-contentful-paint', 'FCP'), ('largest-contentful-paint', 'LCP'), ('total-blocking-time', 'TBT'),
          ('cumulative-layout-shift', 'CLS'), ('speed-index', 'Speed index')]


def find_browser():
    for p in [os.environ.get('CHROME_PATH', ''),
              r'C:\Program Files\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
              shutil.which('google-chrome') or '', shutil.which('chromium') or '']:
        if p and os.path.exists(p):
            return p
    sys.exit('Chrome or Edge not found; set CHROME_PATH')


def signup_cookie():
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    body = json.dumps({'username': 'perf_student', 'password': secrets.token_urlsafe(12), 'display_name': 'Perf'}).encode()
    req = urllib.request.Request(BASE + '/api/signup', data=body, method='POST',
                                 headers={'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud'})
    op.open(req).read()
    return '; '.join('%s=%s' % (c.name, c.value) for c in jar)


def bytes_by_type(lhr):
    out = {}
    for item in lhr['audits'].get('network-requests', {}).get('details', {}).get('items', []):
        t = item.get('resourceType', 'Other')
        out[t] = out.get(t, 0) + (item.get('transferSize') or 0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--label', default='legacy')
    args = ap.parse_args()
    chrome = find_browser()
    npx = shutil.which('npx') or sys.exit('npx not found (install Node)')
    day = datetime.date.today().isoformat()
    out_dir = ROOT / 'docs' / 'perf'
    raw_dir = out_dir / 'raw' / ('%s-%s' % (day, args.label))
    raw_dir.mkdir(parents=True, exist_ok=True)

    tmp = tempfile.mkdtemp()
    env = dict(os.environ)
    for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
        env.pop(k, None)
    env['DB_PATH'] = os.path.join(tmp, 'perf.db')
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'index:app', '--port', str(PORT), '--log-level', 'warning'],
                           cwd=ROOT / 'api', env=env)
    rows = []
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1); break
            except Exception:
                time.sleep(0.3)
        cookie = signup_cookie()
        for name, path, auth in PAGES:
            slug = path.strip('/').replace('/', '_').replace('.html', '') or 'root'
            report = raw_dir / (slug + '.json')
            cmd = [npx, '-y', LIGHTHOUSE, BASE + path, '--quiet', '--output=json', '--output-path=' + str(report),
                   '--only-categories=' + ','.join(CATS), '--form-factor=mobile', '--screenEmulation.mobile',
                   '--throttling-method=simulate', '--chrome-path=' + chrome,
                   '--chrome-flags=--headless=new --no-first-run --user-data-dir=' + os.path.join(tmp, 'chrome-' + slug)]
            if auth:
                cmd.append('--extra-headers=' + json.dumps({'Cookie': cookie}))
            print('lighthouse', path, flush=True)
            subprocess.run(cmd, check=True, shell=False)
            lhr = json.loads(report.read_text(encoding='utf-8'))
            if lhr.get('runtimeError'):
                print('  runtime error:', lhr['runtimeError'])
            final = lhr.get('finalDisplayedUrl', '')
            by = bytes_by_type(lhr)
            rows.append({
                'name': name, 'path': path, 'final': final,
                'scores': {c: round((lhr['categories'][c]['score'] or 0) * 100) for c in CATS},
                'metrics': {label: lhr['audits'][a]['displayValue'].replace('\u00a0', ' ') for a, label in AUDITS},
                'kb_total': round(sum(by.values()) / 1024), 'kb_js': round(by.get('Script', 0) / 1024),
                'kb_doc': round(by.get('Document', 0) / 1024), 'kb_font': round(by.get('Font', 0) / 1024),
            })
    finally:
        srv.terminate()
        try:
            srv.wait(8)
        except Exception:
            srv.kill()

    lines = ['# Performance snapshot: %s (%s)' % (args.label, day), '',
             'Local run of `tools/perf_baseline.py`: Lighthouse %s, mobile, simulated slow 4G with 4x CPU slowdown, '
             'served by uvicorn on this machine (no CDN, no network distance). Compare snapshots with each other, not with field data.'
             % LIGHTHOUSE.split('@')[1], '',
             '| Page | Perf | A11y | Best pr. | FCP | LCP | TBT | CLS | Speed index | Total KB | JS KB | HTML KB | Font KB |',
             '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        s, m = r['scores'], r['metrics']
        flag = '' if r['final'].endswith(r['path']) else ' (redirected to %s)' % r['final'].replace(BASE, '')
        lines.append('| %s%s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |' % (
            r['name'], flag, s['performance'], s['accessibility'], s['best-practices'],
            m['FCP'], m['LCP'], m['TBT'], m['CLS'], m['Speed index'], r['kb_total'], r['kb_js'], r['kb_doc'], r['kb_font']))
    lines += ['', 'Raw reports: `%s/`' % raw_dir.relative_to(ROOT).as_posix(), '']
    md = out_dir / ('%s-%s.md' % (day, args.label))
    md.write_text('\n'.join(lines), encoding='utf-8')
    print('\n'.join(lines))
    print('wrote', md)


if __name__ == '__main__':
    main()
