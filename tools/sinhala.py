# -*- coding: utf-8 -*-
"""Sinhala for extracted lessons: the translation memory of public/static/si.js, applied in Python.

The lessons were written in English with a Tamil twin; Sinhala is a third language that si.js adds in the browser from
/static/si/_ui.json (the app) and /static/si/<lesson>.json (a chapter), keyed by the English text. This module does the
same so the lesson JSON carries the Sinhala students see today. It follows si.js step by step:
- lookup(): the exact English text; else the same with its numbers lifted out ("{0} steps"); else a "prefix{*}"; else built
  from "~phrases" when every English word is covered.
- version(): a unit is an element with a Tamil twin (its English HTML is the key), or one holding only bare inline tags;
  a unit with a translation is replaced whole; an element that is not a unit has its bare text pieces translated; drawings
  only have their plain text labels translated; glossary Tamil cells show the Sinhala term ("@English").
Text with no translation stays English, exactly as on the page.
"""
import copy, json, re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
DICTS = ROOT / 'public' / 'static' / 'si'
SKIP = {'script', 'style', 'noscript', 'textarea', 'input', 'select', 'option', 'code', 'pre'}
INLINE = {'b', 'i', 'em', 'strong', 'sub', 'sup', 'br', 'small', 'u', 'mark', 's'}
VOID = {'br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'area', 'col', 'embed', 'param', 'track'}
ATTRS = ('aria-label', 'title', 'placeholder', 'alt')


def norm(s) -> str:
    return re.sub(r'\s+', ' ', '' if s is None else str(s)).strip()


def _esc_text(s: str) -> str:
    return s.replace('&', '&amp;').replace('\xa0', '&nbsp;').replace('<', '&lt;').replace('>', '&gt;')


def _esc_attr(s: str) -> str:
    return s.replace('&', '&amp;').replace('\xa0', '&nbsp;').replace('"', '&quot;')


def inner_html(el: Tag) -> str:
    """The element's content serialised the way a browser's innerHTML does (the dictionaries were keyed from that)."""
    out = []
    for c in el.children:
        if isinstance(c, Tag):
            attrs = ''.join(' %s="%s"' % (k, _esc_attr(' '.join(v) if isinstance(v, list) else str(v))) for k, v in c.attrs.items())
            out.append('<%s%s>' % (c.name, attrs) + ('' if c.name in VOID else inner_html(c) + '</%s>' % c.name))
        elif isinstance(c, NavigableString) and type(c) is NavigableString:
            out.append(_esc_text(str(c)))
    return ''.join(out)


def _swap(s: str, frm: str, to: str) -> str:
    """Replace a phrase only where it stands alone, not inside a longer English word (si.js swap())."""
    out, i = '', 0
    while True:
        j = s.find(frm, i)
        if j < 0:
            return out + s[i:]
        before = s[j - 1] if j else ' '
        after = s[j + len(frm)] if j + len(frm) < len(s) else ' '
        ok_b = not re.match(r'[A-Za-z]', before) or not re.match(r'[A-Za-z]', frm[0])
        ok_a = not re.match(r'[A-Za-z]', after) or not re.match(r'[A-Za-z]', frm[-1])
        out += s[i:j] + (to if ok_b and ok_a else frm)
        i = j + len(frm)


class Sinhala:
    def __init__(self, page: str, entries: dict | None = None):
        """The app's and the chapter's translation memory (or `entries` instead, for tests)."""
        self.dict, self.phrases, self.prefixes, self.cache = {}, [], [], {}
        sources = [entries] if entries is not None else [
            json.loads((DICTS / (n + '.json')).read_text(encoding='utf-8')) for n in ('_ui', page) if (DICTS / (n + '.json')).exists()]
        for source in sources:
            for k, v in source.items():
                if k.startswith('~'):
                    self.phrases.append((k[1:], v))
                elif k.endswith('{*}'):
                    self.prefixes.append((k[:-3], v))
                else:
                    self.dict[norm(k)] = v
        self.phrases.sort(key=lambda p: -len(p[0]))
        self.used = 0

    # ------------------------------------------------------------------------------------- si.js lookup()
    def lookup(self, en):
        k = norm(en)
        if not k:
            return None
        if k in self.dict:
            return self.dict[k]
        if k in self.cache:
            return self.cache[k]
        for p, v in self.prefixes:
            if k.startswith(p) and len(k) > len(p):
                return v.replace('{*}', k[len(p):])
        out, nums = None, []

        def lift(m):
            nums.append(m.group(0))
            return '{%d}' % (len(nums) - 1)
        t = re.sub(r'\d+(?:\.\d+)?', lift, k)
        if nums and t in self.dict:
            out = re.sub(r'\{(\d+)\}', lambda m: nums[int(m.group(1))] if int(m.group(1)) < len(nums) else m.group(0), self.dict[t])
        if out is None and len(k) <= 160 and self.phrases:
            r = k
            for frm, to in self.phrases:
                r = _swap(r, frm, to)
            if r != k and not re.search(r'[A-Za-z]{2,}', re.sub(r'&[a-z]+;', '', re.sub(r'<[^>]*>', '', r))):
                out = r
        self.cache[k] = out
        return out

    def text(self, en: str):
        """Sinhala for a plain string (story lines, quiz texts), or None."""
        si = self.lookup(en)
        return si if si is not None and norm(si) != norm(en) else None

    # ------------------------------------------------------------------------------------- si.js translateEl() / walk()
    def _unit_key(self, el: Tag) -> str:
        if el.get('data-ta') is not None:                       # a lesson's own bilingual unit (data-en = its English HTML)
            return norm(inner_html(el))
        if not el.contents:
            return ''
        for d in el.find_all(True):
            if d.name not in INLINE or d.attrs:
                return ''
        return norm(inner_html(el))

    def _set_html(self, el: Tag, html: str):
        el.clear()
        for part in list(BeautifulSoup(html, 'html.parser').contents):
            el.append(part)
        self.used += 1

    def _translate(self, el: Tag):
        if el.name in SKIP:
            return
        in_svg = el.name == 'svg' or el.find_parent('svg') is not None
        if in_svg:
            if el.name in ('text', 'tspan') and not el.find(True):
                si = self.lookup(el.get_text())
                if si is not None:
                    self._set_html(el, si)
                return
            for c in [c for c in el.children if isinstance(c, Tag)]:
                self._translate(c)
            return
        cls = el.get('class') or []
        nxt = el.find_next_sibling(True)
        if el.name == 'td' and 'tt' in cls and nxt is not None and 'te' in (nxt.get('class') or []):
            si = self.lookup('@' + norm(nxt.get_text()))
            if si is not None:
                self._set_html(el, si)
            return
        if el.name == 'td' and 'te' in cls and el.find_parent('table', class_='gloss'):
            return
        if el.name == 'th' and el.find_previous_sibling(True) is None and el.find_parent('table', class_='gloss'):
            if inner_html(el) != 'සිංහල':                    # the glossary's first column is the Sinhala one here
                self._set_html(el, 'සිංහල')
            return
        k = self._unit_key(el)
        if k and re.search(r'[A-Za-z]', k):
            si = self.lookup(k)
            if si is not None:
                self._set_html(el, si)
                return
        if not k:                                               # mixed content: translate the bare text pieces
            for n in list(el.children):
                if type(n) is NavigableString:
                    raw, tk = str(n), norm(str(n))
                    if not tk or not re.search(r'[A-Za-z]{2,}', tk):
                        continue
                    ts = self.lookup(tk)
                    if ts is not None:
                        n.replace_with(NavigableString(raw.replace(tk, ts) if tk in raw else ts))
                        self.used += 1
        for a in ATTRS:
            v = el.get(a)
            if v:
                t = self.lookup(v)
                if t is not None:
                    el[a] = t
        for c in [c for c in el.children if isinstance(c, Tag)]:
            self._translate(c)

    def version(self, el: Tag):
        """The element as a student reading Sinhala sees it, or None if nothing in it is translated."""
        el = copy.copy(el)
        before = self.used
        wrapper = BeautifulSoup('<div></div>', 'html.parser').div
        wrapper.append(el)
        # si.js watches the page and translates changed content again, so English words left inside a translated unit
        # (e.g. "min") are caught by the phrase rules on the next pass; repeat until nothing changes, as the page does.
        for _ in range(4):
            mark = self.used
            self._translate(el)
            if self.used == mark:
                break
        return el if self.used > before else None
