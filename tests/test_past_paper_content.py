# -*- coding: utf-8 -*-
"""The past paper validator (tools/validate_past_papers.py) refuses broken banks.

    python tests/test_past_paper_content.py
"""
import copy, json, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools import validate_past_papers as v  # noqa: E402

BANK = json.loads((v.BANKS / '2015.json').read_text(encoding='utf-8'))


def problems(bank):
    out = []
    v.check_bank(2015, bank, set(), v.r2_media(), out)
    return out


class PastPaperBanks(unittest.TestCase):
    def test_the_real_bank_passes(self):
        self.assertEqual(problems(copy.deepcopy(BANK)), [])

    def test_broken_banks_are_refused(self):
        mcq = next(i for i, q in enumerate(BANK['questions']) if q['type'] == 'mcq')
        written = next(i for i, q in enumerate(BANK['questions']) if q['type'] == 'written')

        def broken(change):
            b = copy.deepcopy(BANK)
            change(b)
            return problems(b)
        cases = {
            'answer not an option': lambda b: b['questions'][mcq].update(correct=9),
            'missing why-not explanations': lambda b: b['questions'][mcq].update(optionExplanations=[]),
            'id of another year': lambda b: b['questions'][mcq].update(id='ol2099-i-01'),
            'id used twice': lambda b: b['questions'].append(copy.deepcopy(b['questions'][mcq])),
            'no English prompt': lambda b: b['questions'][mcq].update(prompt={'ta': 'x'}),
            'duplicate part labels': lambda b: b['questions'][written]['parts'].append(copy.deepcopy(b['questions'][written]['parts'][0])),
            'missing scan page': lambda b: b['questions'][mcq].update(pages=[99]),
            'unknown paper': lambda b: b['questions'][mcq].update(paper='III'),
            # the explanations
            'no hint': lambda b: b['questions'][mcq].pop('hint'),
            'one step only': lambda b: b['questions'][mcq].update(steps=b['questions'][mcq]['steps'][:1]),
            'no Tamil mistake': lambda b: b['questions'][mcq]['detailedExplanation']['commonMistake'].pop('ta'),
            'the idea repeats the hint': lambda b: b['questions'][mcq]['detailedExplanation'].update(concept=b['questions'][mcq]['hint']),
            'a step repeats the answer': lambda b: b['questions'][mcq]['steps'].append(b['questions'][mcq]['explanation']),
            'two options, one reason': lambda b: b['questions'][mcq]['optionExplanations'].__setitem__(1, b['questions'][mcq]['optionExplanations'][0]),
            'placeholder text': lambda b: b['questions'][mcq]['optionExplanations'][0].update(en='Use the principle in the worked explanation to check this choice.'),
            'part without Sinhala answer': lambda b: b['questions'][written]['parts'][0]['answer'].pop('si'),
            'part without practice': lambda b: b['questions'][written]['parts'][0]['detailedExplanation'].pop('practice'),
        }
        for name, change in cases.items():
            self.assertTrue(broken(change), name)


if __name__ == '__main__':
    unittest.main()
