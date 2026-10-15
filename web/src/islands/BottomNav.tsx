import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';

// Phone bottom bar: four places, each one thing (the same links, words and drawings as public/static/nav.js).
// Learn is the course home: continue where you were, and every chapter. Practice is the learning feed and each chapter's
// practice questions. Lessons themselves have their own Back / Next.
const WORDS = {
  learn: ['Learn', 'படி', 'ඉගෙනුම'],
  practice: ['Practice', 'பயிற்சி', 'පුහුණුව'],
  papers: ['Past papers', 'கடந்த வினாத்தாள்', 'පසුගිය ප්‍රශ්න පත්‍ර'],
  me: ['Me', 'நான்', 'මම'],
} as const;
const ICONS = {
  learn: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  practice: 'M13 3 5 14h6l-1 7 8-11h-6z',
  papers: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5',
  me: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6',
};
const HREF = { learn: '/lessons/index.html', practice: '/feed/', papers: '/past-papers/', me: '/account' };
export type Place = keyof typeof WORDS;

export default function BottomNav({ here }: { here: Place }) {
  const lang = useStore($lang);
  useEffect(loadPrefs, []);
  const k = lang === 'ta' ? 1 : lang === 'si' ? 2 : 0;
  return (
    <nav class="bnav" aria-label={['Main', 'முதன்மை', 'ප්‍රධාන'][k]}>
      {(Object.keys(WORDS) as Place[]).map((id) => (
        <a href={HREF[id]} aria-current={id === here ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONS[id]} /></svg>
          <span>{WORDS[id][k]}</span>
        </a>
      ))}
    </nav>
  );
}
