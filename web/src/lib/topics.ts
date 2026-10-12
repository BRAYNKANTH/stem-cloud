// The topic view (docs/migration-plan-astro.md, Phase 5): the same lesson organised by concept. A topic in the lesson
// format points at the lesson's own content; these helpers find it. Build time only.
import type { Card, Exercise, Lesson, QuizQuestion, Topic } from './content-types';
import type { Tri, StepInfo } from './lesson-ui';
import { lessonUrl } from './lessons';

export const topicsUrl = (l: Lesson): string => lessonUrl(l) + 'topics/';
export const topicUrl = (l: Lesson, t: Pick<Topic, 'id'>): string => topicsUrl(l) + t.id + '/';
export const REVISION_ID = 'revision';

/** The learning steps of a topic page. English only, as on the current topic pages: Tamil and Sinhala wording has to be
 * written and reviewed by the content team (docs/owner-tasks.md). */
export const TOPIC_STEPS = {
  understand: { label: { en: 'Understand' }, what: { en: 'Introductory notes' }, icon: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5', phase: 'p1' },
  watch: { label: { en: 'Watch' }, what: { en: 'Topic video' }, icon: 'M3 5h18v14H3zM10 9l5 3-5 3z', phase: 'p1' },
  explore: { label: { en: 'Explore' }, what: { en: 'Story or real-life application' }, icon: 'M14 4l6 6M4 20l9-9M11 7l6 6-4 4-6-6z', phase: 'p3' },
  practice: { label: { en: 'Practice' }, what: { en: 'Topic exercises' }, icon: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4', phase: 'p4' },
} as const satisfies Record<string, { label: Tri; what: Tri; icon: string; phase: StepInfo['phase'] }>;
export type TopicStep = keyof typeof TOPIC_STEPS;

export const REVISION_PARTS = {
  summary: { label: { en: 'Summary' }, what: { en: 'Key points, definitions and formulas' }, icon: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2', phase: 'p1' },
  mixed: { label: { en: 'Mixed practice' }, what: { en: 'Questions that join several topics' }, icon: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4', phase: 'p4' },
  quiz: { label: { en: 'Chapter quiz' }, what: { en: 'Check the whole chapter' }, icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01', phase: 'p4' },
} as const satisfies Record<string, { label: Tri; what: Tri; icon: string; phase: StepInfo['phase'] }>;

export const TOPIC_UI = {
  byTopic: { en: 'Learn by topic' },
  topics: { en: 'Topics' },
  revision: { en: 'Chapter revision' },
  lesson: { en: 'The whole lesson' },
  notes: { en: 'Detailed notes' },
  atGlance: { en: 'At a glance' },
  unit: { en: 'Unit' },
  mistake: { en: 'Common mistake' },
  youWill: { en: 'You will' },
  noSteps: { en: 'This topic has notes only so far.' },
} satisfies Record<string, Tri>;

/** The steps a topic has content for, in order; a step without content is left out, never filled in. */
export function stepsOf(t: Topic): TopicStep[] {
  const out: TopicStep[] = ['understand'];
  if (t.watch) out.push('watch');
  if (t.explore) out.push('explore');
  if (t.practice?.length) out.push('practice');
  return out;
}

export function stepInfos(steps: readonly string[], table: Record<string, { label: Tri; icon: string; phase: StepInfo['phase'] }>): StepInfo[] {
  return steps.map((id) => ({ id, label: table[id]!.label, phase: table[id]!.phase, icon: table[id]!.icon }));
}

export function notesCard(l: Lesson, t: Topic): Card | undefined {
  const notes = l.steps.find((s) => s.type === 'notes');
  return notes && notes.type === 'notes' ? notes.cards[t.notes_card] : undefined;
}

export type Practice = { kind: 'quiz'; q: QuizQuestion } | { kind: 'exercise'; x: Exercise; chip: Tri };

/** The lesson's quiz questions and exercises with these ids, in this order. */
export function practice(l: Lesson, ids: readonly string[]): Practice[] {
  const found = new Map<string, Practice>();
  for (const s of l.steps) {
    if (s.type === 'quiz') for (const q of s.questions) found.set(q.id, { kind: 'quiz', q });
    if (s.type === 'exercises') for (const g of s.groups) for (const x of g.items) found.set(x.id, { kind: 'exercise', x, chip: g.chip });
  }
  return ids.map((i) => found.get(i)).filter((p): p is Practice => !!p);
}

/** Runs of the same kind, so consecutive quiz questions share one Quiz island. */
export function runs(items: Practice[]): Practice[][] {
  const out: Practice[][] = [];
  for (const p of items) {
    const last = out[out.length - 1];
    if (last && last[0]!.kind === p.kind) last.push(p);
    else out.push([p]);
  }
  return out;
}
