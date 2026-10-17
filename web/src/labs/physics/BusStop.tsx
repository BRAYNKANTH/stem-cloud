import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang } from '../../stores/prefs';
import './bus-stop.css';

/*
 * The island of "Cycling to the Bus Stop" (BusStopLab.tsx): it hydrates when the lab step comes into view and only then
 * fetches the game (its levels carry their words in three languages), so the lesson page's first load stays inside the
 * JavaScript budget (web/scripts/budget.mjs). Until it arrives, a box of the same size holds its place.
 */
const TITLE = { en: 'Cycling to the Bus Stop', ta: 'பஸ் நிறுத்தத்துக்கு சைக்கிளில்', si: 'බස් නැවතුමට බයිසිකලයෙන්' };

export default function BusStop() {
  const lang = useStore($lang);
  const [Game, setGame] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    import('./BusStopLab').then((m) => { if (live) setGame(() => m.default); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  if (Game) return <Game />;
  return (
    <section class="bus bus-wait" aria-busy={!failed}>
      <h3>{TITLE[lang] ?? TITLE.en}</h3>
      <p class="hint">{failed ? (lang === 'ta' ? 'ஏற்ற முடியவில்லை. இணைப்பைச் சரிபார்த்து பக்கத்தை மீண்டும் திற.' : lang === 'si' ? 'පූරණය කළ නොහැක. සම්බන්ධතාව පරීක්ෂා කර පිටුව නැවත විවෘත කරන්න.' : 'Could not load. Check your connection and open the page again.') : '…'}</p>
    </section>
  );
}
