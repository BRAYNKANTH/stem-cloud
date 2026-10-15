# -*- coding: utf-8 -*-
"""The formula cards (content/formulas/physics.json, shown by web/src/pages/shell/formulas): complete in the three
languages, each from a lesson of the catalog, each still matching its lesson's formula box, and every formula box of
the lessons on a card.

    python tests/test_formula_cards.py
"""
import json, re, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARDS = json.loads((ROOT / 'content' / 'formulas' / 'physics.json').read_text(encoding='utf-8'))['cards']
CATALOG = {l['id']: l for l in json.loads((ROOT / 'content' / 'catalog.json').read_text(encoding='utf-8'))['lessons']}
LANGS = ('en', 'ta', 'si')
# lesson boxes that are not a formula (a list of definitions, a reminder, one worked number) or are on another card
NOT_A_CARD = {'Definitions', 'Remember', 'Two parallel forces, same direction', 'v–t graph', 'Gravitational acceleration',
              'Displacement (uniform velocity)'}


def english(x):
    """Every English text of a lesson (the "en" of its {en, ta, si} texts)."""
    if isinstance(x, dict):
        if isinstance(x.get('en'), str):
            yield x['en']
        for v in x.values():
            yield from english(v)
    elif isinstance(x, list):
        for v in x:
            yield from english(v)


def boxes(lesson_id):
    """The English labels of a lesson's formula boxes."""
    lesson = json.loads((ROOT / CATALOG[lesson_id]['path']).read_text(encoding='utf-8'))
    return {re.sub(r'<[^>]+>', '', m) for t in english(lesson) for m in re.findall(r'class="flabel">(.*?)</div>', t)}


def tri(x):
    return isinstance(x, dict) and all(isinstance(x.get(l), str) and x[l].strip() for l in LANGS)


class FormulaCards(unittest.TestCase):
    def test_ids_are_unique(self):
        ids = [c['id'] for c in CARDS]
        self.assertEqual(len(ids), len(set(ids)))

    def test_each_card_is_complete_in_three_languages(self):
        for c in CARDS:
            with self.subTest(card=c['id']):
                self.assertIn(c['lesson'], CATALOG)
                self.assertTrue(tri(c['name']))
                self.assertTrue(tri(c['worked']))
                self.assertTrue((isinstance(c['math'], str) and c['math'].strip()) or tri(c['math']))
                if 'tip' in c:
                    self.assertTrue(tri(c['tip']))
                for s in c['symbols']:
                    self.assertTrue(s['s'].strip() and s['unit'].strip() and all(s[l].strip() for l in LANGS), s)

    def test_a_card_still_matches_its_lesson(self):
        for c in CARDS:
            if c.get('box'):
                with self.subTest(card=c['id']):
                    self.assertIn(c['box'], boxes(c['lesson']))

    def test_every_formula_box_of_the_lessons_is_on_a_card(self):
        on_cards = {(c['lesson'], c['box']) for c in CARDS if c.get('box')}
        missing = [(l, b) for l in CATALOG for b in boxes(l) if b not in NOT_A_CARD and (l, b) not in on_cards]
        self.assertEqual(missing, [])

    def test_tamil_uses_the_lessons_terms(self):
        text = json.dumps(CARDS, ensure_ascii=False)
        self.assertNotRegex(text, 'லேப்|மிஷன்')


if __name__ == '__main__':
    unittest.main()
