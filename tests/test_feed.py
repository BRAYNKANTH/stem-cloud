# -*- coding: utf-8 -*-
"""The learning feed: its cards (content/feed/physics.json) and its API (stemcloud/routers/feed.py).

    python tests/test_feed.py
"""
import json, os, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TMP = tempfile.mkdtemp()
for k in ('DATABASE_URL', 'POSTGRES_URL', 'VERCEL'):
    os.environ.pop(k, None)
os.environ['DB_PATH'] = os.path.join(TMP, 'feed.db')

from fastapi.testclient import TestClient  # noqa: E402
from stemcloud.main import app  # noqa: E402
import re  # noqa: E402
# the scenes the feed can draw: the names in web/src/feed/scenes.ts
SCENES = set(re.search(r'export const SCENES[^=]*=\s*\{([^}]*)\}', (ROOT / 'web' / 'src' / 'feed' / 'scenes.ts').read_text(encoding='utf-8')).group(1).replace(' ', '').split(','))

H = {'X-Requested-With': 'stemcloud'}
CARDS = json.loads((ROOT / 'content' / 'feed' / 'physics.json').read_text(encoding='utf-8'))['cards']
FORMULAS = {c['id'] for c in json.loads((ROOT / 'content' / 'formulas' / 'physics.json').read_text(encoding='utf-8'))['cards']}
LESSONS = {l['id'] for l in json.loads((ROOT / 'content' / 'catalog.json').read_text(encoding='utf-8'))['lessons']}
LANGS = ('en', 'ta', 'si')


def tri(x):
    return isinstance(x, dict) and all(isinstance(x.get(l), str) and x[l].strip() for l in LANGS)


class Cards(unittest.TestCase):
    def test_ids_are_unique(self):
        ids = [c['id'] for c in CARDS]
        self.assertEqual(len(ids), len(set(ids)))

    def test_each_card_is_complete_in_three_languages(self):
        for c in CARDS:
            with self.subTest(card=c['id']):
                self.assertIn(c['lesson'], LESSONS)
                self.assertIn(c['type'], ('predict', 'mcq', 'tf', 'idea'))
                if c['type'] == 'idea':
                    self.assertIn(c['formula'], FORMULAS)
                    continue
                self.assertTrue(tri(c['why']))
                if c['type'] == 'tf':
                    self.assertTrue(tri(c['statement']))
                    self.assertIn(c['correct'], (0, 1))
                else:
                    self.assertTrue(tri(c['question']))
                    self.assertTrue(len(c['options']) >= 2 and all(tri(o) for o in c['options']))
                    self.assertIn(c['correct'], range(len(c['options'])))
                if c['type'] == 'predict':
                    self.assertTrue(c.get('scene') in SCENES or c.get('video'), 'a predict card needs a scene or a video')

    def test_the_feed_mixes_its_cards(self):
        kinds = [c['type'] for c in CARDS]
        self.assertTrue(all(kinds[i] != kinds[i + 1] or kinds[i] == 'idea' for i in range(len(kinds) - 1)), kinds)


class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()
        # the first account is the admin (signup is closed after it); it creates the two students
        r = cls.client.post('/api/signup', headers=H, json={'username': 'feed_admin', 'password': 'feed-password-1'})
        assert r.status_code == 200, r.text
        for name in ('feed_one', 'feed_two'):
            r = cls.client.post('/api/admin/create-user', headers=H, json={'username': name, 'password': 'feed-password-1', 'role': 'student'})
            assert r.status_code == 200, r.text
        cls.client.post('/api/logout', headers=H)
        r = cls.client.post('/api/login', headers=H, json={'username': 'feed_one', 'password': 'feed-password-1'})
        assert r.status_code == 200, r.text

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def answer(self, card, choice, client=None):
        return (client or self.client).post('/api/feed/answer', headers=H, json={'card': card, 'choice': choice})

    def test_the_page_is_for_signed_in_students(self):
        r = TestClient(app).get('/feed/', follow_redirects=False)
        self.assertEqual((r.status_code, r.headers['location']), (302, '/login?next=/feed/'))

    def test_an_answer_returns_the_right_choice_and_the_poll(self):
        r = self.answer('mcq-diver', 0)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {'correct': 1, 'first': True, 'counts': [1, 0, 0]})

    def test_only_the_first_answer_counts(self):
        self.answer('tf-sound-vacuum', 1)
        r = self.answer('tf-sound-vacuum', 0)
        self.assertEqual(r.json(), {'correct': 0, 'first': False, 'counts': [0, 1]})

    def test_everyone_is_counted(self):
        self.answer('mcq-wave-speed', 2)
        other = TestClient(app)
        other.__enter__()
        try:
            r = other.post('/api/login', headers=H, json={'username': 'feed_two', 'password': 'feed-password-1'})
            self.assertEqual(r.status_code, 200)
            r = self.answer('mcq-wave-speed', 0, other)
            self.assertEqual(r.json()['counts'], [1, 0, 1])
        finally:
            other.__exit__(None, None, None)

    def test_a_practice_question_is_answered_too(self):
        r = self.answer('hp-022', 1)                       # content/practice/physics/hydrostatic-pressure.json
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {'correct': 1, 'first': True, 'counts': [0, 1, 0, 0]})
        self.assertEqual(self.answer('hp-003', 1).json()['counts'], [0, 1])     # true / false: two choices

    def test_bad_answers_are_refused(self):
        self.assertEqual(self.answer('no-such-card', 0).status_code, 400)
        self.assertEqual(self.answer('idea-ohm', 0).status_code, 400)          # a formula card has nothing to answer
        self.assertEqual(self.answer('mcq-diver', 3).status_code, 400)
        self.assertEqual(self.answer('tf-parallel', True).status_code, 400)
        r = self.client.post('/api/feed/answer', json={'card': 'mcq-diver', 'choice': 1})   # no CSRF header
        self.assertEqual(r.status_code, 403)
        r = TestClient(app).post('/api/feed/answer', headers=H, json={'card': 'mcq-diver', 'choice': 1})
        self.assertEqual(r.status_code, 401)


if __name__ == '__main__':
    unittest.main()
