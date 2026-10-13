# -*- coding: utf-8 -*-
"""The cut-over switch (stemcloud/cutover.py): off by default; "trial" and "on" send the current lesson and topic pages
to the new ones (302, then 301); frames (?embed=1) and pages without a new one are left alone.

    python tests/test_cutover.py
"""
import json, os, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TMP = tempfile.mkdtemp()
for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL', 'CUTOVER'):
    os.environ.pop(k, None)
os.environ['DB_PATH'] = os.path.join(TMP, 'cutover.db')

from fastapi.testclient import TestClient  # noqa: E402
from stemcloud import cutover  # noqa: E402
from stemcloud.main import app  # noqa: E402

LESSONS = [json.loads(f.read_text(encoding='utf-8')) for f in sorted((ROOT / 'content').glob('*/*/*/lesson.json'))]


class Cutover(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app, follow_redirects=False)
        os.environ.pop('CUTOVER', None)

    def tearDown(self):
        os.environ.pop('CUTOVER', None)

    def test_off_by_default(self):
        r = self.c.get('/lessons/chapter-05-friction.html')
        self.assertEqual(r.status_code, 302)                       # the current page's own sign-in redirect
        self.assertTrue(r.headers['location'].startswith('/login?next=/lessons/'))
        self.assertEqual(cutover.mode(), 'off')

    def test_every_lesson_page_has_its_new_page(self):
        self.assertEqual(len(cutover.LESSON_URL), len(LESSONS) + 1)  # + past papers
        for L in LESSONS:
            self.assertEqual(cutover.LESSON_URL[L['legacy']['file']], '/learn/%s/g%d/%s/' % (L['subject'], L['grade'], L['slug']))

    def test_trial_is_temporary(self):
        os.environ['CUTOVER'] = 'trial'
        r = self.c.get('/lessons/chapter-05-friction.html')
        self.assertEqual((r.status_code, r.headers['location']), (302, '/learn/physics/g10/friction/'))

    def test_on_is_permanent(self):
        os.environ['CUTOVER'] = 'on'
        for L in LESSONS:
            r = self.c.get('/lessons/' + L['legacy']['file'])
            self.assertEqual(r.status_code, 301, L['id'])
            self.assertEqual(r.headers['location'], '/learn/%s/g%d/%s/' % (L['subject'], L['grade'], L['slug']))
        r = self.c.get('/lessons/past-papers.html')
        self.assertEqual((r.status_code, r.headers['location']), (301, '/past-papers/'))
        r = self.c.get('/topics/unit-02-motion-in-a-straight-line')
        self.assertEqual((r.status_code, r.headers['location']), (301, '/learn/physics/g10/motion-in-a-straight-line/topics/'))

    def test_left_alone(self):
        os.environ['CUTOVER'] = 'on'
        # a frame, the contents page, a page with no new one, and the lessons' files (images, JSON) are served as now
        for path in ('/lessons/chapter-05-friction.html?embed=1', '/lessons/index.html', '/lessons/intro-physics-is-easy.html', '/lessons/topics/index.json'):
            r = self.c.get(path)
            self.assertNotEqual(r.status_code, 301, path)
            self.assertNotIn('/learn/', r.headers.get('location', ''), path)

    def test_unknown_setting_is_off(self):
        os.environ['CUTOVER'] = 'yes please'
        self.assertEqual(cutover.mode(), 'off')
        self.assertNotEqual(self.c.get('/lessons/chapter-05-friction.html').headers['location'], '/learn/physics/g10/friction/')


if __name__ == '__main__':
    unittest.main(verbosity=2)
