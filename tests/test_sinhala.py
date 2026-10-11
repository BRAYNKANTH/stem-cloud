# -*- coding: utf-8 -*-
"""The Python port of the Sinhala layer (tools/sinhala.py) follows public/static/si.js rule by rule.
It was also compared with si.js running in a browser on two chapters: 591 of 591 text units identical.

    python tests/test_sinhala.py
"""
import sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from bs4 import BeautifulSoup  # noqa: E402
from tools.sinhala import Sinhala, inner_html  # noqa: E402

D = {
    'Friction': 'ඝර්ෂණය',
    'You have {0} steps left': 'ඔබට පියවර {0}ක් ඉතිරියි',
    'Chapter {*}': 'පරිච්ඡේදය {*}',
    '~min': 'මිනි.',
    '~speed': 'වේගය',
    'Friction <b>opposes</b> motion': 'ඝර්ෂණය චලිතයට <b>විරුද්ධ</b> වේ',
    'Heat &amp; light': 'තාපය සහ ආලෝකය',
    '@Work': 'කාර්යය',
    'Label': 'ලේබලය',
}


def el(html):
    return BeautifulSoup(html, 'html.parser').find(True)


class Lookup(unittest.TestCase):
    def setUp(self):
        self.S = Sinhala('none', entries=D)

    def test_exact_and_whitespace(self):
        self.assertEqual(self.S.lookup('Friction'), 'ඝර්ෂණය')
        self.assertEqual(self.S.lookup('  Friction \n'), 'ඝර්ෂණය')
        self.assertIsNone(self.S.lookup('Gravity'))

    def test_numbers_prefixes_and_phrases(self):
        self.assertEqual(self.S.lookup('You have 3 steps left'), 'ඔබට පියවර 3ක් ඉතිරියි')
        self.assertEqual(self.S.lookup('Chapter 12'), 'පරිච්ඡේදය 12')
        self.assertEqual(self.S.lookup('t = 1 min = 60 s'), 't = 1 මිනි. = 60 s')
        self.assertIsNone(self.S.lookup('the min of speed'), 'a phrase result with English words left is not used')
        self.assertIsNone(self.S.lookup('admin'), 'a phrase never replaces part of a longer word')


class Version(unittest.TestCase):
    def setUp(self):
        self.S = Sinhala('none', entries=D)

    def test_bilingual_unit_is_keyed_by_its_english_html(self):
        v = self.S.version(el('<p data-ta="x">Friction <b>opposes</b> motion</p>'))
        self.assertEqual(inner_html(v), 'ඝර්ෂණය චලිතයට <b>විරුද්ධ</b> වේ')

    def test_html_is_serialised_like_a_browser(self):
        self.assertEqual(inner_html(el('<p>Heat &amp; light<br/>x\xa0y</p>')), 'Heat &amp; light<br>x&nbsp;y')
        self.assertEqual(self.S.version(el('<p data-ta="x">Heat &amp; light</p>')).get_text(), 'තාපය සහ ආලෝකය')

    def test_mixed_content_translates_bare_text_and_attributes(self):
        v = self.S.version(el('<div title="Label"><span class="ic" data-x="1">*</span>Friction</div>'))
        self.assertIn('ඝර්ෂණය', v.get_text())
        self.assertEqual(v['title'], 'ලේබලය')

    def test_drawings_only_translate_plain_labels(self):
        v = self.S.version(el('<svg><text>Friction</text><text><tspan>Friction</tspan></text><path d="M0 0"/></svg>'))
        texts = [t.get_text() for t in v.find_all('text')]
        self.assertEqual(texts[0], 'ඝර්ෂණය')
        self.assertEqual(v.find('tspan').get_text(), 'ඝර්ෂණය')

    def test_glossary_cells_and_heading(self):
        v = self.S.version(el('<table class="gloss"><tr><th>Tamil</th><th>English</th></tr>'
                              '<tr><td class="tt">வேலை</td><td class="te">Work</td></tr></table>'))
        self.assertEqual(v.find('th').get_text(), 'සිංහල')
        self.assertEqual(v.select_one('td.tt').get_text(), 'කාර්යය')
        self.assertEqual(v.select_one('td.te').get_text(), 'Work', 'the English column stays English')

    def test_nothing_translated_gives_none(self):
        self.assertIsNone(self.S.version(el('<p data-ta="x">Gravity pulls</p>')))

    def test_a_second_pass_catches_english_left_in_a_translation(self):
        S = Sinhala('none', entries={'Time: 1 min': 'කාලය: 1 min', '~min': 'මිනි.'})
        self.assertEqual(S.version(el('<p data-ta="x">Time: 1 min</p>')).get_text(), 'කාලය: 1 මිනි.')


if __name__ == '__main__':
    unittest.main()
