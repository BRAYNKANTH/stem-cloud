# -*- coding: utf-8 -*-
"""The lesson format (content_schema/lesson.py): what it accepts and what it refuses.

    python tests/test_content_schema.py
"""
import copy, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pydantic import ValidationError  # noqa: E402
from content_schema import Lesson  # noqa: E402
from tools import validate_content  # noqa: E402

GOOD = {
    'schema': 2, 'id': 'physics.g10.friction', 'slug': 'friction', 'subject': 'physics', 'grade': 10, 'number': '5',
    'title': {'en': 'Friction', 'ta': 'உராய்வு', 'si': 'ඝර්ෂණය'},
    'legacy': {'id': 'c5', 'file': 'chapter-05-friction.html'},
    'steps': [
        {'type': 'story', 'id': 'story', 'title': {'en': 'Why does it stop?'},
         'lines': [{'speaker': 'raja', 'scene': '📚', 'text': {'en': 'Why did my book stop?', 'ta': 'ஏன் நின்னுச்சு?'}, 'audio': {'ta': 'c5/line00.mp3'}}]},
        {'type': 'notes', 'id': 'notes', 'heading': {'title': {'en': 'Notes'}},
         'cards': [{'title': {'en': 'Friction'}, 'body': {'en': '<p>Friction <b>opposes</b> motion: <svg viewBox="0 0 10 10"><path d="M0 0h10"/></svg></p>'}, 'section': '5.1'}]},
        {'type': 'lab', 'id': 'lab', 'heading': {'title': {'en': 'Lab'}}, 'legacy': {'file': 'chapter-05-friction.html', 'hash': 'lab'}},
        {'type': 'quiz', 'id': 'quiz', 'heading': {'title': {'en': 'Quiz'}},
         'questions': [{'id': 'q1', 'prompt': {'en': 'Unit of force?'}, 'options': [{'en': 'N'}, {'en': 'J'}], 'answer': 0}]},
    ],
}


def lesson(**changes):
    d = copy.deepcopy(GOOD)
    for path, value in changes.items():
        node = d
        keys = path.split('__')
        for k in keys[:-1]:
            node = node[int(k)] if k.isdigit() else node[k]
        last = keys[-1]
        node[int(last) if last.isdigit() else last] = value
    return d


class Format(unittest.TestCase):
    def test_a_good_lesson_passes(self):
        l = Lesson.model_validate(GOOD)
        self.assertEqual([s.type for s in l.steps], ['story', 'notes', 'lab', 'quiz'])
        self.assertEqual(l.model_dump(by_alias=True, exclude_none=True)['schema'], 2)

    def refused(self, data, why):
        with self.assertRaises(ValidationError) as e:
            Lesson.model_validate(data)
        self.assertIn(why, str(e.exception))

    def test_unsafe_html_is_refused(self):
        for bad, why in [('<p>hi<script>alert(1)</script></p>', 'tag not allowed'), ('<p onclick="x()">hi</p>', 'event handler'),
                         ('<a href="javascript:x()">x</a>', 'script or data URL'), ('<img src="data:text/html;base64,AA">', 'script or data URL'),
                         ('<iframe src="/x"></iframe>', 'tag not allowed')]:
            self.refused(lesson(steps__1__cards__0__body={'en': bad}), why)

    def test_ids_must_match_and_be_unique(self):
        self.refused(lesson(id='physics.g11.friction'), 'id must be')
        d = lesson(); d['steps'][2]['id'] = 'notes'
        self.refused(d, 'used twice')
        d = lesson(); d['steps'][3]['questions'].append(copy.deepcopy(d['steps'][3]['questions'][0]))
        self.refused(d, 'used twice')
        self.refused(lesson(id='Physics.G10.Friction'), 'pattern')

    def test_answers_speakers_languages_and_unknown_fields(self):
        self.refused(lesson(steps__3__questions__0__answer=2), 'not one of the 2 options')
        self.refused(lesson(steps__0__lines__0__speaker='kamal'), "'raja' or 'chittu'")
        self.refused(lesson(title={'en': 'Friction', 'fr': 'Friction'}), 'Extra inputs')
        self.refused(lesson(title={'ta': 'உராய்வு'}), 'en')
        self.refused(lesson(steps__2__legacy={'file': '../../etc/passwd', 'hash': 'lab'}), 'pattern')

    def test_validator_lists_progress_ids(self):
        ids = validate_content.all_ids(Lesson.model_validate(GOOD))
        self.assertIn('physics.g10.friction/quiz', ids)
        self.assertIn('physics.g10.friction/q1', ids)
        cov = validate_content.coverage(Lesson.model_validate(GOOD))
        self.assertGreater(cov['texts'], 5)
        self.assertLess(cov['si'], 100)


TOPIC = {'id': 'what-is-friction', 'title': {'en': 'What friction is'}, 'blurb': {'en': 'A force that opposes motion.'},
         'learn': {'en': 'Say what friction does.'}, 'section': '5.1', 'notes_card': 0,
         'glance': {'definitions': [{'term': {'en': 'Friction'}, 'meaning': {'en': 'A force that opposes sliding.'}}]},
         'watch': {'title': {'en': 'A book slides'}, 'animation': {'file': 'chapter-05-friction.html', 'hash': 'watch'}, 'from': 0, 'to': 10, 'duration': 30},
         'explore': {'type': 'story', 'title': {'en': 'A push'}, 'scenario': {'en': 'You push a book.'},
                     'steps': [{'ask': {'en': 'Does it stop?'}, 'options': [{'en': 'Yes'}, {'en': 'No'}], 'correct': 0, 'why': {'en': 'Friction.'}}]},
         'practice': ['q1']}


class Topics(unittest.TestCase):
    """The topic view points at the lesson's own content."""

    def with_topic(self, **changes):
        t = copy.deepcopy(TOPIC)
        t.update(changes)
        return lesson(topics=[t], revision={'mixed': [], 'quiz': ['q1']})

    def test_a_good_topic_passes_and_its_id_is_tracked(self):
        l = Lesson.model_validate(self.with_topic())
        self.assertEqual(l.topics[0].watch.start, 0)
        self.assertIn('physics.g10.friction/topic:what-is-friction', validate_content.all_ids(l))

    def test_topics_refuse_content_the_lesson_does_not_have(self):
        for bad in (dict(practice=['q9']), dict(notes_card=3),
                    dict(watch={**TOPIC['watch'], 'from': 20, 'to': 10}),
                    dict(explore={**TOPIC['explore'], 'steps': [{**TOPIC['explore']['steps'][0], 'correct': 2}]})):
            with self.assertRaises(ValidationError, msg=str(bad)):
                Lesson.model_validate(self.with_topic(**bad))
        with self.assertRaises(ValidationError):
            Lesson.model_validate(lesson(topics=[TOPIC, TOPIC]))                       # the same topic id twice
        with self.assertRaises(ValidationError):
            Lesson.model_validate(lesson(revision={'mixed': ['xc-9'], 'quiz': []}))   # not an exercise of this lesson


if __name__ == '__main__':
    unittest.main()
