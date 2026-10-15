# -*- coding: utf-8 -*-
"""The practice question validator (tools/validate_practice.py) passes the real pools and catches broken questions.

    python tests/test_practice.py
"""
import copy, json, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools import validate_practice as v  # noqa: E402

POOL = ROOT / 'content' / 'practice' / 'physics' / 'hydrostatic-pressure.json'
DATA = json.loads(POOL.read_text(encoding='utf-8'))


def problems(data):
    with tempfile.TemporaryDirectory(dir=ROOT) as d:
        p = Path(d) / 'pool.json'
        p.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        out = []
        v.check_pool(p, set(), out)
        return out


def by_id(data, qid):
    return next(q for q in data['questions'] if q['id'] == qid)


class Practice(unittest.TestCase):
    def test_the_pressure_pool_passes_and_has_its_mix(self):
        self.assertEqual(problems(copy.deepcopy(DATA)), [])
        qs = DATA['questions']
        self.assertEqual(len(qs), 100)
        kinds = {t: sum(q['type'] == t for q in qs) for t in ('mcq', 'tf')}
        self.assertTrue(kinds['tf'] >= 25 and kinds['mcq'] >= 50, kinds)
        self.assertGreaterEqual(sum('figure' in q for q in qs), 15)
        self.assertEqual({q['level'] for q in qs}, {'recall', 'apply', 'think'})

    def test_a_wrong_sum_is_caught(self):
        d = copy.deepcopy(DATA)
        by_id(d, 'hp-022')['calc'] = '3 * 1000 * 9'          # 27 000, but the right option says 30 000 Pa
        self.assertTrue(any('hp-022' in p and 'calc gives' in p for p in problems(d)))

    def test_two_right_answers_are_caught(self):
        d = copy.deepcopy(DATA)
        by_id(d, 'hp-004')['options'][1] = {'en': '300 N m⁻²', 'ta': '300 N m⁻²'}
        self.assertTrue(any('hp-004' in p and 'also gives the answer' in p for p in problems(d)))

    def test_a_missing_language_and_a_repeated_question_are_caught(self):
        d = copy.deepcopy(DATA)
        by_id(d, 'hp-001')['q']['ta'] = ''
        d['questions'].append(dict(by_id(d, 'hp-002'), id='hp-101'))
        out = problems(d)
        self.assertTrue(any('hp-001' in p and 'missing a language' in p for p in out), out)
        self.assertTrue(any('hp-101' in p and 'same question' in p for p in out), out)

    def test_an_unknown_figure_is_caught(self):
        d = copy.deepcopy(DATA)
        by_id(d, 'hp-009')['figure'] = {'kind': 'rocket'}
        self.assertTrue(any('hp-009' in p and 'cannot draw' in p for p in problems(d)))


if __name__ == '__main__':
    unittest.main()
