// The lesson page's own words and step kinds. English and Tamil are the current lesson pages' (the lesson framework
// script in site/lessons/*.html and public/static/player.js); Sinhala is public/static/si/_ui.json, which si.js uses
// for the same words. Nothing here is new wording except where marked.
import type { Lesson } from './content-types';
import type { Lang } from '../stores/prefs';

export interface Tri {
  en: string;
  ta?: string | null;
  si?: string | null;
}

/** The text in the student's language, or English when that language is missing. */
export const pick = (t: Tri, lang: Lang): string => (lang !== 'en' && t[lang]) || t.en;

export const UI = {
  back: { en: 'Back', ta: 'பின்னாடி', si: 'ආපසු' },
  previous: { en: 'Previous step', ta: 'முந்தைய படி', si: 'කලින් පියවර' },
  next: { en: 'Next', ta: 'அடுத்து', si: 'ඊළඟ' },
  nextColon: { en: 'Next: ', ta: 'அடுத்து: ', si: 'ඊළඟ: ' },
  finish: { en: 'Finish', ta: 'முடிவு', si: 'අවසානය' },
  map: { en: 'Lesson map', ta: 'பாடத்தின் வரைபடம்', si: 'පාඩම් සිතියම' },
  steps: { en: 'Lesson steps', ta: 'எல்லா படிகளும்', si: 'පාඩම් පියවර' },
  formulas: { en: 'Formula cards for this chapter', ta: 'இந்தப் பாடத்தின் சூத்திர அட்டைகள்', si: 'මෙම පරිච්ඡේදයේ සූත්‍ර කාඩ්පත්' },
  practise: { en: 'Practise 10 questions', ta: '10 வினாக்களைப் பயிற்சி செய்', si: 'ප්‍රශ්න 10ක් පුහුණු වන්න' },   // new wording: the chapter's practice round (/feed/#<chapter>)
  reviseFormulas: { en: 'Revise with the formula cards', ta: 'சூத்திர அட்டைகளுடன் மீட்டல் செய்', si: 'සූත්‍ර කාඩ්පත් සමඟ පුනරීක්ෂණය කරන්න' },
  stepMenu: { en: 'Step menu', ta: 'படிகளின் பட்டியல்', si: 'පියවර මෙනුව' },
  stepNav: { en: 'Step navigation', ta: 'படி மாற்றம்', si: 'පියවර අතර යාම' },
  close: { en: 'Close', ta: 'மூடு', si: 'වසන්න' },
  done: { en: 'done', ta: 'முடிஞ்சது', si: 'අවසන්' },
  contents: { en: 'Back to Learn', ta: 'படி பக்கத்துக்கு திரும்பு', si: 'ඉගෙනුම වෙත ආපසු' },   // the course home, named as its tab (BottomNav)
  finished: { en: 'You finished this lesson!', ta: 'இந்த பாடத்த முடிச்சுட்டே!', si: 'ඔබ මෙම පාඩම අවසන් කළා!' },
  proud: { en: 'Well done! Raja and Chittu are proud of you.', ta: 'சபாஷ்! ராஜாவும் சிட்டுவும் உன்ன நினைச்சு பெருமைப்படறாங்க.', si: 'සුබ පැතුම්! රාජා සහ චිට්ටුට ඔබ ගැන ආඩම්බරයි.' },
  allLessons: { en: 'All lessons', ta: 'எல்லா பாடங்கள்', si: 'සියලුම පාඩම්' },
  showAnswer: { en: 'Show answer', ta: 'பதில் பாரு', si: 'පිළිතුර පෙන්වන්න' },
  hideAnswer: { en: 'Hide answer', ta: 'பதிலை மறை', si: 'පිළිතුර සඟවන්න' },
  terms: { en: 'Terms', ta: 'வார்த்தைகள்', si: 'පද' },
  meanings: { en: 'Meanings', ta: 'விளக்கங்கள்', si: 'අර්ථ' },
  readAloud: { en: 'Read this step aloud', ta: 'இந்த படியை படிச்சுக் காட்டு', si: 'මෙම පියවර හඬ නඟා කියවන්න' },
  pauseReading: { en: 'Pause reading', ta: 'படிப்பதை நிறுத்து' },
  raja: { en: 'Raja', ta: 'ராஜா', si: 'රාජා' },
  chittu: { en: 'Chittu', ta: 'சிட்டு', si: 'චිට්ටු' },
  // new wording (no current page has it): Tamil and Sinhala need a reviewer (docs/owner-tasks.md)
  oneStep: { en: 'One step at a time', ta: null, si: null },
  wholePage: { en: 'Whole lesson on one page', ta: null, si: null },
  openFull: { en: 'Open it in the full lesson', ta: null, si: null },
} satisfies Record<string, Tri>;

/** Chapter line under the title: "Grade 10 · Chapter 2" (Sinhala from _ui.json; the Tamil pages have no such line). */
export const chapterLine = (l: Pick<Lesson, 'grade' | 'number'>): Tri => ({
  en: `Grade ${l.grade} · Chapter ${l.number}`,
  si: `${l.grade} ශ්‍රේණිය · ${l.number} පරිච්ඡේදය`,     // _ui.json "Grade {0} · Chapter {1}"
});

export type Phase = 'p1' | 'p2' | 'p3' | 'p4';
export const PHASES: { k: Phase; label: Tri }[] = [
  { k: 'p1', label: { en: 'Meet the idea', ta: 'கருத்தை அறி', si: 'අදහස හඳුනා ගන්න' } },
  { k: 'p2', label: { en: 'Learn step by step', ta: 'படிப்படியாகக் கற்க', si: 'පියවරෙන් පියවර ඉගෙන ගන්න' } },
  { k: 'p3', label: { en: 'Try and explore', ta: 'முயற்சி செய்து ஆராய்', si: 'උත්සාහ කර ගවේෂණය කරන්න' } },
  { k: 'p4', label: { en: 'Check and practise', ta: 'சரிபார்த்துப் பயிற்சி செய்', si: 'පරීක්ෂා කර පුහුණු වන්න' } },
];

type StepType = Lesson['steps'][number]['type'];
/** Step kind -> chip label, phase of the lesson path and drawn icon (public/static/player.js). */
export const KINDS: Record<StepType, { label: Tri; phase: Phase; icon: string }> = {
  story: { label: { en: 'Story', ta: 'கதை', si: 'කතාව' }, phase: 'p1', icon: 'M4 5h16v11H9l-5 4z' },
  basics: { label: { en: 'Basics', ta: 'அடிப்படை', si: 'මූලික කරුණු' }, phase: 'p1', icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z' },
  watch: { label: { en: 'Watch it', ta: 'பார்த்தறி', si: 'බලන්න' }, phase: 'p1', icon: 'M3 5h18v14H3zM10 9l5 3-5 3z' },
  notes: { label: { en: 'Notes', ta: 'குறிப்புகள்', si: 'සටහන්' }, phase: 'p2', icon: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5' },
  activities: { label: { en: 'Try it', ta: 'செய்து பாரு', si: 'කර බලමු' }, phase: 'p2', icon: 'M14 4l6 6M4 20l9-9M11 7l6 6-4 4-6-6z' },
  lab: { label: { en: 'Lab', ta: 'ஆய்வகம்', si: 'විද්‍යාගාරය' }, phase: 'p3', icon: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10' },
  game: { label: { en: 'Challenge', ta: 'சவால்', si: 'ක්‍රීඩාව' }, phase: 'p3', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1' },
  sort: { label: { en: 'Sort game', ta: 'வகைப்படுத்தும் விளையாட்டு', si: 'වර්ග කිරීමේ ක්‍රීඩාව' }, phase: 'p3', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  quiz: { label: { en: 'Quiz', ta: 'வினாடி வினா', si: 'ප්‍රශ්නාවලිය' }, phase: 'p4', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01' },
  worked: { label: { en: 'Examples', ta: 'உதாரணங்கள்', si: 'නිදසුන්' }, phase: 'p4', icon: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4' },
  exercises: { label: { en: 'Exam practice', ta: 'பரீட்சைப் பயிற்சி', si: 'පුහුණුව' }, phase: 'p4', icon: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4' },
  recap: { label: { en: 'Recap', ta: 'மீள்பார்வை', si: 'සාරාංශය' }, phase: 'p4', icon: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4' },
  summary: { label: { en: 'Summary', ta: 'பாடச் சுருக்கம்', si: 'සාරාංශය' }, phase: 'p4', icon: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2' },
};

export const FLAG_ICON = 'M5 21V4M5 4h11l-2 4 2 4H5';
export const FINISH_ID = 'finish';

/** What the player needs about each step (passed to the islands as props, so they never get the whole lesson). */
export interface StepInfo {
  id: string;
  label: Tri;
  phase: Phase;
  icon: string;
}

export function stepInfo(lesson: Lesson): StepInfo[] {
  return lesson.steps.map((s) => ({ id: s.id, label: KINDS[s.type].label, phase: KINDS[s.type].phase, icon: KINDS[s.type].icon }));
}
