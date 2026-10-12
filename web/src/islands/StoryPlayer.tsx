import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useStore } from '@nanostores/preact';
import { $lang, type Lang } from '../stores/prefs';
import { $ids, $step, go } from '../stores/lesson';
import { UI, pick, type Tri } from '../lib/lesson-ui';
import { hasTTS, missingVoice, play, silence, speak, toast } from '../lib/speech';
import { reward } from '../stores/progress';

export interface Line {
  speaker: 'raja' | 'chittu';
  scene?: string | null;
  text: Tri;
  audio?: Partial<Record<Lang, string>> | null;
}

// Words from the current story (the lesson page's story script, public/static/story.js and voice.js).
const W = {
  time: { en: '🎬 Story time', ta: '🎬 கதை நேரம்', si: '🎬 කතා වේලාව' },
  prev: { en: 'Previous line', ta: 'முந்தைய வரி', si: 'පෙර පේළිය' },
  next: { en: 'Next line', ta: 'அடுத்த வரி', si: 'ඊළඟ පේළිය' },
  line: { en: 'Story line ', ta: 'கதை வரி ', si: 'කතා පේළිය ' },
  swipe: { en: 'swipe to read on', ta: 'தொடர்ந்து படிக்க ஸ்வைப் பண்ணு', si: 'කියවීම දිගටම කරගෙන යාමට ස්වයිප් කරන්න' },
  story: { en: 'Raja and Chittu story', ta: 'ராஜா சிட்டு கதை', si: 'රාජා සහ චිට්ටුගේ කතාව' },
  rec: { en: 'Recorded voices', ta: 'பதிவு செஞ்ச குரல்', si: 'පටිගත කළ හඬ' },
  tts: { en: 'Phone voice', ta: 'போன் குரல்', si: 'දුරකථන හඬ' },
  off: { en: 'Voices off', ta: 'குரல் ஆஃப்', si: 'හඬ අක්‍රීයයි' },
  noTTS: { en: 'This browser cannot read aloud.', ta: 'இந்த பிரவுசர் படிச்சுக் காட்ட முடியாது.' },
} satisfies Record<string, Tri>;

type Mode = 'off' | 'rec' | 'tts';
const MODES: Mode[] = ['off', 'rec', 'tts'];

function get(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}
const calm = () => document.documentElement.classList.contains('stem-calm');

const SPEAKER = 'M11 5 6 9H3v6h3l5 4V5z';
const WAVES = 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13';
const MUTED = 'M16 9l5 6M21 9l-5 6';

/**
 * The story (the lesson page's own story script with public/static/story.js and the story voices of voice.js): one
 * line at a time, typed out, with Raja and Chittu taking turns. Swipe, tap the bubble or use the arrow keys; the small
 * Previous / Next buttons stay. Voices cycle off -> recorded Tamil voices (where the line has a recording) -> the
 * phone's own voice, remembered as stem_story_mode. Without JavaScript the page shows every line as a list instead.
 */
export default function StoryPlayer({ stepId, lines, cta, raja, chittu }: {
  stepId: string;
  lines: Line[];
  cta?: Tri | null;
  raja?: ComponentChildren;
  chittu?: ComponentChildren;
}) {
  const lang = useStore($lang);
  const step = useStore($step);
  const ids = useStore($ids);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(-1);      // characters typed so far; -1 = the whole line
  const [mode, setMode] = useState<Mode>('off');
  const [swipes, setSwipes] = useState(0);
  const [nudge, setNudge] = useState(0);
  const [slide, setSlide] = useState<'' | 'so-in-r' | 'so-in-l'>('');
  const stage = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLSpanElement>(null);
  const L = (t: Tri) => pick(t, lang);

  const line = lines[idx]!;
  const full = L(line.text);
  const typing = shown >= 0 && shown < full.length;
  const last = idx === lines.length - 1;
  // the line on screen and whether it is still being typed, as of the latest press: two presses (keys, swipes) can come
  // before the next render, and each must count
  const now = useRef({ idx: 0, typing: false });
  now.current = { idx, typing };
  const onScreen = () => !!stage.current && stage.current.offsetParent !== null;

  useEffect(() => {
    const m = get('stem_story_mode') ?? (get('stem_story_voice') === 'on' ? 'rec' : 'off');
    setMode(MODES.includes(m as Mode) ? (m as Mode) : 'off');
    setSwipes(parseInt(get('stem_swipes') ?? '0', 10) || 0);
    const stop = () => silence();
    window.addEventListener('pagehide', stop);
    return () => window.removeEventListener('pagehide', stop);
  }, []);

  // the step bar's Listen button on the story step switches the voices (LessonPlayer STORY_VOICE_EVENT)
  useEffect(() => {
    const onListen = () => cycle();
    window.addEventListener('stem-story-voice', onListen);
    return () => window.removeEventListener('stem-story-voice', onListen);
  });

  // typing effect (none when animations are off)
  useEffect(() => {
    if (shown < 0 || shown >= full.length) return;
    const t = setTimeout(() => setShown((n) => Math.min(full.length, n + 2)), 28);
    return () => clearTimeout(t);
  }, [shown, full]);

  // a new line or a new language: type it, say it, tell screen readers
  const voice = (m: Mode) => {
    if (m === 'off' || !onScreen()) return;
    const who = line.speaker === 'raja' ? 'R' : 'C';
    const viaTTS = () => {
      if (!missingVoice(lang)) speak(full, lang, who);
    };
    const rec = line.audio?.[lang];
    if (m === 'rec' && rec) play('/static/audio/story/' + rec, lang, viaTTS);
    else viaTTS();
  };
  useEffect(() => {
    voice(mode);
    if (idx > 0 && live.current && onScreen()) live.current.textContent = `${idx + 1} / ${lines.length}. ${L(UI[line.speaker])}: ${full}`;
  }, [idx, lang]);

  // leaving the story step stops the voices
  useEffect(() => {
    if (step >= 0 && ids[step] !== stepId) silence();
  }, [step]);

  const show = (i: number, dir: 1 | -1) => {
    if (i === lines.length - 1) void reward('story', 5);       // the story read to its end: 5 XP once, as on the current pages
    now.current = { idx: i, typing: !calm() };
    setIdx(i);
    setShown(calm() ? -1 : 0);
    setSlide(dir > 0 ? 'so-in-r' : 'so-in-l');
    setTimeout(() => setSlide(''), 320);
    try {
      navigator.vibrate?.(5);
    } catch {
      /* no vibration */
    }
    setSwipes((n) => {
      set('stem_swipes', String(n + 1));
      return n + 1;
    });
  };
  const wobble = () => setNudge((n) => n + 1);
  const advance = (dir: 1 | -1, tap = false) => {
    if (dir > 0 && now.current.typing) {       // a tap first finishes the line being typed; a swipe moves on
      now.current.typing = false;
      setShown(-1);
      if (tap) return;
    }
    const to = now.current.idx + dir;
    if (to < 0 || to >= lines.length) return wobble();
    show(to, dir);
  };

  // arrow keys while the story is on screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || !onScreen()) return;
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName || '')) return;
      e.preventDefault();
      advance(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // swipe and tap on the stage
  const g = useRef({ x: 0, y: 0, t: 0, dx: 0, on: false, horiz: false, id: -1 });
  const down = (e: PointerEvent) => {
    if ((e.target as Element).closest('button, a, input') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    g.current = { x: e.clientX, y: e.clientY, t: Date.now(), dx: 0, on: true, horiz: false, id: e.pointerId };
    if (bubble.current) bubble.current.style.transition = 'none';
  };
  const move = (e: PointerEvent) => {
    const s = g.current;
    if (!s.on || e.pointerId !== s.id) return;
    s.dx = e.clientX - s.x;
    if (!s.horiz && Math.abs(s.dx) > 10 && Math.abs(s.dx) > Math.abs(e.clientY - s.y) * 1.4) {
      s.horiz = true;
      try {
        stage.current?.setPointerCapture(s.id);
      } catch {
        /* already released */
      }
    }
    if (s.horiz && bubble.current) {
      const lim = Math.max(-90, Math.min(90, s.dx * 0.55));
      bubble.current.style.transform = `translateX(${lim}px)`;
      bubble.current.style.opacity = String(1 - Math.min(0.45, Math.abs(lim) / 160));
    }
  };
  const up = (e: PointerEvent) => {
    const s = g.current;
    if (!s.on || e.pointerId !== s.id) return;
    s.on = false;
    const b = bubble.current;
    if (b) {
      b.style.transition = 'transform .2s ease, opacity .2s ease';
      b.style.transform = '';
      b.style.opacity = '';
      setTimeout(() => { b.style.transition = ''; }, 230);
    }
    if (s.horiz && Math.abs(s.dx) > 48) advance(s.dx < 0 ? 1 : -1);
    else if (!s.horiz && Math.abs(s.dx) < 8 && Date.now() - s.t < 400 && e.type === 'pointerup') advance(1, true);
  };

  const cycle = () => {
    const m = MODES[(MODES.indexOf(mode) + 1) % MODES.length]!;
    setMode(m);
    set('stem_story_mode', m);
    if (m === 'off') return silence();
    if (m === 'tts' && !hasTTS()) return toast(L(W.noTTS));
    voice(m);
  };
  const recorded = mode === 'rec' && !!line.audio?.[lang];
  const voiceLabel = L(recorded ? W.rec : mode === 'off' ? W.off : W.tts);
  const nextId = ids[ids.indexOf(stepId) + 1];

  return (
    <div class="so-player">
      <div class="so-head">
        <span class="so-chip">{L(W.time)}</span>
        <button type="button" class={'so-voice' + (mode !== 'off' ? ' on' : '')} aria-pressed={mode !== 'off'} aria-label={voiceLabel} title={voiceLabel} onClick={cycle}>
          {mode !== 'off' && !recorded
            ? <span class="sv-phone" aria-hidden="true">📱</span>
            : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={SPEAKER} fill="currentColor" /><path d={mode === 'off' ? MUTED : WAVES} /></svg>}
          <span class="sv-label">{voiceLabel}</span>
        </button>
      </div>
      <div class="so-stage" ref={stage} role="group" aria-roledescription="story" aria-label={L(W.story)}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div class={'so-chars ' + slide}>
          <div class={'so-char r' + (line.speaker === 'raja' ? ' on' + (typing ? ' talking' : '') : '')}>{raja}<div class="so-nm">{L(UI.raja)} 🐒</div></div>
          <div class={'so-char c' + (line.speaker === 'chittu' ? ' on' + (typing ? ' talking' : '') : '')}>{chittu}<div class="so-nm">{L(UI.chittu)} 🐦</div></div>
        </div>
        {line.scene && <div class="so-scene" aria-hidden="true">{line.scene}</div>}
        <div key={nudge} ref={bubble} class={'so-bubble ' + (line.speaker === 'raja' ? 'r' : 'c') + ' ' + slide + (nudge ? ' so-wobble' : '')} lang={lang}>
          <span>{shown < 0 ? full : full.slice(0, shown)}</span>
          {typing && <span class="so-caret" />}
        </div>
        <div class="so-ctrls">
          <button type="button" class="btn" onClick={() => advance(-1)} disabled={idx === 0}>{L(W.prev)}</button>
          <div class="so-dots" aria-hidden="true">{lines.map((_, i) => <i key={i} class={i < idx ? 'done' : i === idx ? 'now' : ''} />)}</div>
          <button type="button" class="btn primary" onClick={() => advance(1)} disabled={last && !typing}>{L(W.next)}</button>
        </div>
        <div class={'so-hint' + (swipes >= 3 ? ' quiet' : '')}>
          <span class="so-arr" aria-hidden="true">‹</span><span class="so-finger" aria-hidden="true">👆</span><span class="so-arr" aria-hidden="true">›</span>
          <span class="so-hint-t">{L(W.swipe)}</span>
        </div>
        <p class="so-line-label">{L(W.line)}{idx + 1} / {lines.length}</p>
        {cta && nextId && (
          <div class={'so-cta' + (last ? ' show' : '')}>
            <a class="btn primary" href={'#' + nextId} onClick={(e) => { e.preventDefault(); go(ids.indexOf(nextId)); }}>{L(cta)}</a>
          </div>
        )}
        <span class="visually-hidden" aria-live="polite" ref={live} />
      </div>
    </div>
  );
}
