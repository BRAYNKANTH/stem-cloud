import { useStore } from '@nanostores/preact';
import { $reading, nextRate, nextVoice, pause, resume, step, stop } from '../stores/reader';

// The icons of public/static/voice.js; the labels there are English only.
const ICON = {
  prev: <path d="M6 5v14M19 5 9 12l10 7z" fill="currentColor" />,
  next: <path d="M18 5v14M5 5l10 7L5 19z" fill="currentColor" />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></>,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  stop: <path d="M6 6l12 12M18 6 6 18" />,
};
const Svg = ({ k }: { k: keyof typeof ICON }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[k]}</svg>
);

/** The reading controls at the bottom of the screen while a step is read aloud (voice.js #stem-vp). */
export default function VoiceControls() {
  const r = useStore($reading);
  if (!r.on) return null;
  return (
    <div id="stem-vp" role="group" aria-label="Reading controls">
      <button type="button" data-a="prev" aria-label="Previous" onClick={() => step(-1)}><Svg k="prev" /></button>
      <button type="button" data-a="pp" aria-label={r.paused ? 'Play' : 'Pause'} onClick={() => (r.paused ? resume() : pause())}><Svg k={r.paused ? 'play' : 'pause'} /></button>
      <button type="button" data-a="next" aria-label="Next" onClick={() => step(1)}><Svg k="next" /></button>
      <button type="button" data-a="rate" aria-label="Speed" onClick={nextRate}>{r.rate}×</button>
      <button type="button" data-a="voice" aria-label="Change voice" onClick={nextVoice}><Svg k="mic" /></button>
      <span class="vp-pos">{r.i + 1} / {r.n}</span>
      <button type="button" data-a="stop" aria-label="Stop" onClick={stop}><Svg k="stop" /></button>
    </div>
  );
}
