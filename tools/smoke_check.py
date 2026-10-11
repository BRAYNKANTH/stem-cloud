# -*- coding: utf-8 -*-
"""Smoke test of a deployed STEM Cloud: public pages, the API health check, static files and the login gate.

    python tools/smoke_check.py                                   # https://www.stemcloud.site
    python tools/smoke_check.py --base https://example.vercel.app
    python tools/smoke_check.py --astro /privacy,/terms           # also require these pages to come from the Astro build

Only public URLs are requested; no login, no secrets. Every page reports whether it was served by the Astro build
(static, <meta name="generator" content="Astro ...">) or by the Python function. Exits 1 if any check fails.
Runs in GitHub Actions after each production deploy (.github/workflows/smoke.yml), which can reach the site from
networks where it is blocked.
"""
import argparse, json, sys, urllib.error, urllib.request

UA = 'stemcloud-smoke-check/1 (+https://github.com/BRAYNKANTH/stem-cloud)'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def get(base, path):
    req = urllib.request.Request(base + path, headers={'User-Agent': UA})
    try:
        r = OPENER.open(req, timeout=30)
    except urllib.error.HTTPError as e:
        r = e
    body = r.read().decode('utf-8', 'replace')
    return r.status if hasattr(r, 'status') else r.code, {k.lower(): v for k, v in r.headers.items()}, body


def served_by(headers, body):
    if 'name="generator" content="Astro' in body:
        return 'astro'
    if headers.get('content-type', '').startswith('text/html'):
        return 'python'
    return '-'


# (path, expected status, text that must appear, header that must contain a value)
CHECKS = [
    ('/healthz', 200, '"ok":true', None),
    ('/', 200, 'STEM', None),
    ('/home', 200, 'STEM', None),
    ('/about', 200, 'STEM', None),
    ('/privacy', 200, 'What we keep', None),
    ('/privacy/', None, None, None),          # 200 (Astro) or a redirect to /privacy (Python); never an error
    ('/terms', 200, 'Using STEM Cloud', None),
    ('/login', 200, None, None),
    ('/lessons/index.html', 302, None, ('location', '/login')),       # lessons stay behind login
    ('/account', 302, None, ('location', '/login?next=/account')),    # personal pages stay behind login
    ('/admin', 302, None, ('location', '/login?next=/admin')),
    ('/api/me', 401, None, None),
    ('/static/theme-bright.css', 200, '--sc-ink', ('cache-control', 's-maxage')),   # current app files stay on the CDN
    ('/sw.js', 200, 'VERSION', None),
    ('/manifest.webmanifest', 200, 'STEM Cloud', None),
    ('/next/', 200, 'New app foundation', None),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='https://www.stemcloud.site')
    ap.add_argument('--astro', default='', help='comma-separated paths that must be served by the Astro build')
    ap.add_argument('--media', default='r2', help='expected "media" value in /healthz (empty to skip)')
    args = ap.parse_args()
    base = args.base.rstrip('/')
    must_astro = {p.strip() for p in args.astro.split(',') if p.strip()}
    bad = [p for p in must_astro if not p.startswith('/') or any(c.isspace() for c in p)]
    if bad:          # e.g. Git Bash on Windows turns /privacy into C:/Program Files/Git/privacy
        sys.exit('--astro takes site paths such as /privacy; got %r' % bad)
    fails = []
    print('Smoke check of %s\n' % base)
    for path, status, text, header in CHECKS:
        try:
            code, headers, body = get(base, path)
        except Exception as e:                       # network errors are failures too
            fails.append(path); print('FAIL %-28s %s' % (path, type(e).__name__)); continue
        problems = []
        if status is not None and code != status:
            problems.append('status %s, expected %s' % (code, status))
        if status is None and code >= 400:
            problems.append('status %s' % code)
        if text and text not in body:
            problems.append('missing %r' % text)
        if header and header[1] not in headers.get(header[0], ''):
            problems.append('%s: %r lacks %r' % (header[0], headers.get(header[0]), header[1]))
        who = served_by(headers, body)
        if path in must_astro and who != 'astro':
            problems.append('served by %s, expected astro' % who)
        if path == '/healthz' and args.media and code == 200:
            media = json.loads(body).get('media')
            if media != args.media:
                problems.append('media %r, expected %r' % (media, args.media))
        if problems:
            fails.append(path)
        print('%s %-28s %3s  %-6s %s' % ('FAIL' if problems else 'ok  ', path, code, who, '; '.join(problems)))
    unknown = must_astro - {c[0] for c in CHECKS}
    for path in sorted(unknown):
        try:
            code, headers, body = get(base, path)
        except Exception as e:
            fails.append(path); print('FAIL %-28s %s' % (path, type(e).__name__)); continue
        who = served_by(headers, body)
        ok = code == 200 and who == 'astro'
        if not ok:
            fails.append(path)
        print('%s %-28s %3s  %-6s %s' % ('ok  ' if ok else 'FAIL', path, code, who, '' if ok else 'expected astro'))
    print('\n%s' % ('ALL PASSED' if not fails else 'FAILED: ' + ', '.join(fails)))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
