import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';

// Phone bottom bar (Home / Learn / Papers / Me), the same links, words and drawings as public/static/nav.js.
const WORDS = {
  home: ['Home', 'முகப்பு', 'මුල් පිටුව'],
  learn: ['Learn', 'படி', 'ඉගෙනුම'],
  papers: ['Papers', 'வினாத்தாள்', 'ප්‍රශ්න පත්‍ර'],
  me: ['Me', 'நான்', 'මම'],
} as const;
const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  learn: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  papers: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5',
  me: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6',
};
type Place = keyof typeof WORDS;
const FIRST_LESSON = '/lessons/unit-02-motion-in-a-straight-line.html';

/** Learn = the lesson the student was last in (only a plain lesson file name is trusted), else the first one. */
function learnHref(): string {
  let f: string | null = null;
  try { f = localStorage.getItem('stem_last_lesson'); } catch { /* private mode */ }
  return f && /^[a-z0-9-]+\.html$/.test(f) && f !== 'index.html' && f !== 'past-papers.html' ? '/lessons/' + f : FIRST_LESSON;
}

export default function BottomNav({ here }: { here: Place }) {
  const lang = useStore($lang);
  const [learn, setLearn] = useState(FIRST_LESSON);
  useEffect(() => { loadPrefs(); setLearn(learnHref()); }, []);
  const k = lang === 'ta' ? 1 : lang === 'si' ? 2 : 0;
  const href: Record<Place, string> = { home: '/lessons/index.html', learn, papers: '/lessons/past-papers.html', me: '/account' };
  return (
    <nav class="bnav" aria-label={['Main', 'முதன்மை', 'ප්‍රධාන'][k]}>
      {(Object.keys(WORDS) as Place[]).map((id) => (
        <a href={href[id]} aria-current={id === here ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONS[id]} /></svg>
          <span>{WORDS[id][k]}</span>
        </a>
      ))}
    </nav>
  );
}
