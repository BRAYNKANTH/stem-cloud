// The lessons in content/ (validated by tools/validate_content.py), read at build time. Nothing here reaches the browser.
import type { Lesson } from './content-types';
import type { Tri } from './lesson-ui';

const files = import.meta.glob<Lesson>('../../../content/*/*/*/lesson.json', { eager: true, import: 'default' });

export const LESSONS: Lesson[] = Object.values(files);

/** /learn/<subject>/g<grade>/<chapter>/ (docs/migration-plan-astro.md, section 3.2). */
export const lessonUrl = (l: Pick<Lesson, 'subject' | 'grade' | 'slug'>): string => `/learn/${l.subject}/g${l.grade}/${l.slug}/`;

/**
 * One piece of text in every language, as the parts a page renders: each part says which page languages it is shown
 * for (data-l, read by styles/lesson.css). A missing language is covered by the English part, never copied.
 */
export interface Part {
  lang: 'en' | 'ta' | 'si';
  value: string;
  shownFor: string;
  /** English standing in for a missing language. */
  fallback: boolean;
}

export function parts(t: Tri): Part[] {
  const has = (k: 'ta' | 'si') => typeof t[k] === 'string' && t[k]!.trim() !== '';
  const missing = (['ta', 'si'] as const).filter((k) => !has(k));
  const out: Part[] = [{ lang: 'en', value: t.en, shownFor: ['en', ...missing].join(' '), fallback: missing.length > 0 }];
  for (const k of ['ta', 'si'] as const) if (has(k)) out.push({ lang: k, value: t[k]!, shownFor: k, fallback: false });
  return out;
}
