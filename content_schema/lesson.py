# -*- coding: utf-8 -*-
"""Lesson content format, schema 2: one JSON file per chapter (content/<subject>/g<grade>/<slug>/lesson.json).

This file is the single source of truth. The JSON Schema (content_schema/lesson.schema.json) and the TypeScript types
(web/src/lib/content-types.ts) are generated from it: python tools/content_types.py.

Rules the models enforce:
- Every piece of text a student reads carries English and may carry Tamil and Sinhala ({en, ta, si}). A missing language
  is left out (never copied from English); pages fall back to English and the validator reports coverage.
- Rich text is a small, safe subset of HTML (lesson notes, worked examples and answers are hand-built with tables and
  drawings). No scripts, no event handlers, no javascript: links, no external styles.
- Interactive parts that have not been rebuilt yet (labs, games, the sort game, the animation) point at the existing lesson
  page section ("legacy"), which the new pages show in a frame until they are ported.
- Ids are stable: progress will refer to them, so an id that has shipped must not change (tools/validate_content.py).
"""
import re
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SCHEMA_VERSION = 2
ID = Annotated[str, Field(pattern=r'^[a-z0-9]+(?:[._-][a-z0-9]+)*$', max_length=120)]

# ----------------------------------------------------------------------------------------------- text
_BAD_HTML = [
    (re.compile(r'<\s*(script|style|iframe|object|embed|link|meta|base|form|input|textarea|select)\b', re.I), 'tag not allowed'),
    (re.compile(r'\son[a-z]+\s*=', re.I), 'event handler attribute'),
    (re.compile(r'(?:href|src|xlink:href)\s*=\s*["\']?\s*(?:javascript|vbscript|data):', re.I), 'script or data URL'),
    (re.compile(r'\sstyle\s*=\s*["\'][^"\']*(?:expression\(|url\()', re.I), 'style with url() or expression()'),
]


def check_html(value: str) -> str:
    for rx, why in _BAD_HTML:
        m = rx.search(value)
        if m:
            raise ValueError('unsafe HTML (%s): %r' % (why, value[max(0, m.start() - 20): m.end() + 20]))
    return value


class _Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Text(_Strict):
    """Plain text in each language the lesson has."""
    en: str = Field(min_length=1)
    ta: Optional[str] = None
    si: Optional[str] = None


class Rich(_Strict):
    """A safe subset of HTML in each language the lesson has (see check_html)."""
    en: str = Field(min_length=1)
    ta: Optional[str] = None
    si: Optional[str] = None

    @field_validator('en', 'ta', 'si')
    @classmethod
    def _safe(cls, v):
        return check_html(v) if v is not None else v


class Legacy(_Strict):
    """A part still served by the existing lesson page, shown in a frame: /lessons/<file>?embed=1#<hash>."""
    file: str = Field(pattern=r'^[a-z0-9-]+\.html$', title='LessonFile')
    hash: str = Field(pattern=r'^[a-z0-9_]+$')


class Heading(_Strict):
    title: Text
    sub: Optional[Text] = None


# ----------------------------------------------------------------------------------------------- steps
class StoryLine(_Strict):
    speaker: Literal['raja', 'chittu']
    scene: Optional[str] = Field(default=None, description='Scene emoji drawn above the bubble.')
    text: Text
    audio: Optional[dict[Literal['en', 'ta', 'si'], str]] = Field(default=None, description='Recorded voice per language, path under /static/audio/story/.')


class StoryStep(_Strict):
    type: Literal['story']
    id: ID
    title: Text
    quest: Optional[Rich] = None
    lines: list[StoryLine] = Field(min_length=1)
    cta: Optional[Text] = None


class Card(_Strict):
    title: Text
    body: Rich
    icon: Optional[str] = None
    section: Optional[str] = Field(default=None, description='Textbook section number, e.g. "2.1".')


class BasicsStep(_Strict):
    type: Literal['basics']
    id: ID
    heading: Heading
    hook: Optional[Rich] = None
    cards: list[Card] = Field(min_length=1)


class WatchStep(_Strict):
    type: Literal['watch']
    id: ID
    heading: Heading
    animation: Legacy
    seconds: Optional[int] = None


class NotesStep(_Strict):
    type: Literal['notes']
    id: ID
    heading: Heading
    intro: Optional[Rich] = None
    cards: list[Card] = Field(min_length=1)


class ActivitiesStep(_Strict):
    type: Literal['activities']
    id: ID
    heading: Heading
    body: Rich


class InteractiveStep(_Strict):
    """A lab or game, still the lesson page's own (legacy) until it is rebuilt."""
    type: Literal['lab', 'game', 'sort']
    id: ID
    heading: Heading
    legacy: Legacy
    kind: Optional[str] = Field(default=None, description='Which game, e.g. "pushit", "tugofwar".')


class QuizQuestion(_Strict):
    id: ID
    prompt: Text
    options: list[Text] = Field(min_length=2, max_length=6)
    answer: int = Field(ge=0)
    explain: Optional[Text] = None

    @model_validator(mode='after')
    def _answer_in_range(self):
        if self.answer >= len(self.options):
            raise ValueError('answer %d is not one of the %d options' % (self.answer, len(self.options)))
        return self


class QuizStep(_Strict):
    type: Literal['quiz']
    id: ID
    heading: Heading
    questions: list[QuizQuestion] = Field(min_length=1)


class WorkedExample(_Strict):
    id: ID
    tag: Optional[Text] = None
    body: Rich


class WorkedStep(_Strict):
    type: Literal['worked']
    id: ID
    heading: Heading
    examples: list[WorkedExample] = Field(min_length=1)


class Exercise(_Strict):
    id: ID
    num: str
    prompt: Rich
    answer: Optional[Rich] = None


class ExerciseGroup(_Strict):
    chip: Text
    title: Optional[Text] = None
    items: list[Exercise] = Field(min_length=1)


class ExercisesStep(_Strict):
    type: Literal['exercises']
    id: ID
    heading: Heading
    groups: list[ExerciseGroup] = Field(min_length=1)


class RecapStep(_Strict):
    type: Literal['recap']
    id: ID
    heading: Heading
    cards: list[Rich] = Field(min_length=1)


class GlossaryTerm(_Strict):
    en: str = Field(min_length=1)
    ta: Optional[str] = None
    si: Optional[str] = None


class SummaryStep(_Strict):
    type: Literal['summary']
    id: ID
    heading: Heading
    points: list[Rich] = Field(min_length=1)
    glossary: list[GlossaryTerm] = []
    extra: list[Rich] = Field(default=[], description='Any further summary cards, kept as they are.')


Step = Annotated[Union[StoryStep, BasicsStep, WatchStep, NotesStep, ActivitiesStep, InteractiveStep, QuizStep, WorkedStep,
                       ExercisesStep, RecapStep, SummaryStep], Field(discriminator='type')]


# ----------------------------------------------------------------------------------------------- lesson
class LegacyRef(_Strict):
    id: str = Field(description='The id the current lesson page stores progress under, e.g. "c5".')
    file: str = Field(pattern=r'^[a-z0-9-]+\.html$', title='LessonFile')


class Lesson(_Strict):
    schema_: Literal[2] = Field(alias='schema')
    id: ID = Field(description='Global, stable: "<subject>.g<grade>.<slug>".')
    slug: str = Field(pattern=r'^[a-z0-9-]+$')
    subject: Literal['physics', 'chemistry', 'biology', 'mathematics', 'science']
    grade: int = Field(ge=6, le=13)
    number: str = Field(title='ChapterNumber', description='Chapter or unit number as printed in the textbook, e.g. "5" or "2".')
    title: Text
    legacy: Optional[LegacyRef] = None
    steps: list[Step] = Field(min_length=1)

    model_config = ConfigDict(extra='forbid', populate_by_name=True)

    @model_validator(mode='after')
    def _ids(self):
        if self.id != '%s.g%d.%s' % (self.subject, self.grade, self.slug):
            raise ValueError('id must be "<subject>.g<grade>.<slug>", got %r' % self.id)
        seen = set()
        for s in self.steps:
            if s.id in seen:
                raise ValueError('step id %r is used twice' % s.id)
            seen.add(s.id)
        qids = [q.id for s in self.steps if isinstance(s, QuizStep) for q in s.questions] + \
               [e.id for s in self.steps if isinstance(s, ExercisesStep) for g in s.groups for e in g.items] + \
               [e.id for s in self.steps if isinstance(s, WorkedStep) for e in s.examples]
        dup = sorted({q for q in qids if qids.count(q) > 1})
        if dup:
            raise ValueError('question / exercise / example ids used twice: %s' % ', '.join(dup))
        return self
