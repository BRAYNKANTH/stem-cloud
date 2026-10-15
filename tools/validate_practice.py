# -*- coding: utf-8 -*-
"""Check the practice question pools (content/practice/<subject>/<chapter>.json), the learning feed's questions.

    python tools/validate_practice.py

For every question:
  - an id like hp-001, unique across all pools; a known type (mcq: 3 or 4 options; tf: correct is 1 for true, 0 for
    false), topic and level;
  - the question, every option and the reason in English and Tamil (Sinhala is added after review: when it is there,
    it must be complete too);
  - one right answer, no two options the same, no question asked twice;
  - "calc": the sum is worked out again, and the number in the right option must be its result, and in no other
    option (so a slip in the arithmetic, or two right answers, fails);
  - "figure": a kind the feed can draw (web/src/feed/figures.tsx), with what that kind needs.
Exit code 1 lists every problem.
"""
import ast, json, operator, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POOLS = ROOT / 'content' / 'practice'
CATALOG = {l['id'] for l in json.loads((ROOT / 'content' / 'catalog.json').read_text(encoding='utf-8'))['lessons']}
LEVELS = {'recall', 'apply', 'think'}
FIGURES = {
    'blocks': {'weight', 'dims'}, 'vessels': set(), 'tank': {'depth', 'points'}, 'bottle': set(),
    'hydraulic': {'a1', 'a2', 'f1', 'f2'}, 'barometer': {'h'}, 'utube': set(), 'balance': {'air', 'water'}, 'float': {'weight', 'sub'},
    'graph': {'axis', 'points'}, 'route': {'legs'}, 'forces': {'mass', 'left', 'right'}, 'circuit': {'layout', 'r', 'v'}, 'resistor': {'bands'},
}
OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.Pow: operator.pow}


def calc(expr: str) -> float:
    """A sum of numbers with + - × ÷, powers (** 2, ** 0.5) and brackets, nothing else."""
    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.BinOp) and type(n.op) in OPS:
            return OPS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        raise ValueError('not a plain sum: %s' % expr)
    return ev(ast.parse(expr, mode='eval'))


def number(text: str):
    """The first number in an option ("103 360 Pa" -> 103360, "0.33 N cm⁻²" -> 0.33), or None."""
    text = text.replace('−', '-')                  # the minus sign the questions print
    m = re.search(r'-?\d[\d  ]*(?:\.\d+)?', text)
    return float(re.sub(r'[  ]', '', m.group(0))) if m else None


def same(a: float, b: float) -> bool:
    return abs(a - b) <= 1e-6 * max(1, abs(a), abs(b))


def check_pool(path: Path, seen_ids: set, problems: list):
    data = json.loads(path.read_text(encoding='utf-8'))
    where = path.relative_to(ROOT).as_posix()
    if data.get('lesson') not in CATALOG:
        problems.append('%s: lesson %r is not in the catalog' % (where, data.get('lesson')))
    asked = {}
    for q in data.get('questions', []):
        qid = q.get('id', '?')
        say = lambda msg: problems.append('%s %s: %s' % (where, qid, msg))
        if not re.fullmatch(r'[a-z]{1,4}-\d{3}', qid):
            say('id should look like hp-001')
        if qid in seen_ids:
            say('the id is used twice')
        seen_ids.add(qid)
        langs = ('en', 'ta', 'si') if 'si' in q.get('q', {}) else ('en', 'ta')
        full = lambda t: isinstance(t, dict) and all(isinstance(t.get(l), str) and t[l].strip() for l in langs)
        if not full(q.get('q')):
            say('the question is missing a language (%s)' % ', '.join(langs))
        if not full(q.get('why')):
            say('the reason is missing a language')
        if q.get('level') not in LEVELS:
            say('level should be one of %s' % sorted(LEVELS))
        if not q.get('topic'):
            say('no topic')
        # the same words over a different picture ("from this graph, what is…") is a different question
        key = re.sub(r'\W+', ' ', (q.get('q') or {}).get('en', '').lower()).strip() + json.dumps(q.get('figure'), sort_keys=True)
        if key in asked:
            say('the same question as %s' % asked[key])
        asked[key] = qid
        if q.get('type') == 'tf':
            if q.get('correct') not in (0, 1):
                say('a true / false question has correct 1 (true) or 0 (false)')
        elif q.get('type') == 'mcq':
            opts = q.get('options') or []
            if len(opts) not in (3, 4):
                say('give 3 or 4 options')
            if not all(full(o) for o in opts):
                say('an option is missing a language')
            if type(q.get('correct')) is not int or q['correct'] not in range(len(opts)):
                say('correct is not one of the options')
            for l in langs:
                texts = [(o or {}).get(l, '').strip().lower() for o in opts]
                if len(set(texts)) != len(texts):
                    say('two options are the same (%s)' % l)
            if 'calc' in q and opts and type(q.get('correct')) is int and q['correct'] in range(len(opts)):
                try:
                    want = calc(q['calc'])
                except (ValueError, SyntaxError, ZeroDivisionError) as e:
                    say('calc: %s' % e)
                else:
                    got = number(opts[q['correct']]['en'])
                    if got is None or not same(got, want):
                        say('calc gives %g, but the right option says %r' % (want, opts[q['correct']]['en']))
                    for k, o in enumerate(opts):
                        n = number(o['en'])
                        if k != q['correct'] and n is not None and same(n, want):
                            say('option %d also gives the answer %g' % (k + 1, want))
        else:
            say('type should be mcq or tf')
        fig = q.get('figure')
        if fig is not None:
            if fig.get('kind') not in FIGURES:
                say('the feed cannot draw a %r figure' % fig.get('kind'))
            elif not FIGURES[fig['kind']] <= set(fig):
                say('a %s figure needs %s' % (fig['kind'], ', '.join(sorted(FIGURES[fig['kind']] - set(fig)))))
    return len(data.get('questions', []))


def main():
    problems, seen, total = [], set(), 0
    pools = sorted(POOLS.glob('*/*.json'))
    for p in pools:
        total += check_pool(p, seen, problems)
    if problems:
        print('\n'.join(problems))
        sys.exit('%d problem(s) in the practice questions' % len(problems))
    print('all %d pool(s) valid (%d questions)' % (len(pools), total))


if __name__ == '__main__':
    main()
