import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';
import { $ids, $step, go, show, stepFromHash, setWholePage, wholePage } from '../stores/lesson';
import { PHASES, UI, pick, type StepInfo } from '../lib/lesson-ui';
import { $reading, stop as stopReading, toggle as toggleReading } from '../stores/reader';
import { hasTTS } from '../lib/speech';
import { $lesson, onceId, randomId, record, reward, start as startProgress } from '../stores/progress';

const BACK = 'M15 6l-6 6 6 6';
const NEXT = 'M5 12h14M13 6l6 6-6 6';
const MAP = 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14';
const SPEAKER = 'M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13';
const PAUSE = 'M7 5v14M17 5v14';

/** The story step's Listen switches the story's voices instead (voice.js), heard by StoryPlayer. */
export const STORY_VOICE_EVENT = 'stem-story-voice';

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

/**
 * The lesson player (public/static/player.js on the current pages): one step at a time, a bar under the header with
 * Back / the step you are on / Next, and a lesson map with every step one tap away. "Whole lesson on one page"
 * (stem_view = scroll, the current app's setting) shows every step instead. Without JavaScript every step is shown.
 * Progress v2 (stores/progress.ts): a step shown is opened, a step moved on from is done (as the current pages tick
 * their path), the finish is worth 20 XP once, and the map ticks the steps done. On a topic page the step ids are
 * "topic:<topic>:<step>" (prefix), as the v1 -> v2 migration names them.
 */
export default function LessonPlayer({ steps, lesson, prefix = '' }: { steps: StepInfo[]; lesson: string; prefix?: string }) {
  const lang = useStore($lang);
  const cur = useStore($step);
  const reading = useStore($reading);
  const progress = useStore($lesson);
  const prev = useRef(-1);
  const [scroll, setScroll] = useState(false);
  const [tts, setTts] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const ids = steps.map((s) => s.id);
  const L = (t: Parameters<typeof pick>[0]) => pick(t, lang);

  useEffect(() => {
    loadPrefs();
    void startProgress(lesson);
    $ids.set(ids);
    setScroll(wholePage());
    setTts(hasTTS());
    const fromUrl = () => go(stepFromHash(ids), false);
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    window.addEventListener('hashchange', fromUrl);
    return () => {
      window.removeEventListener('popstate', fromUrl);
      window.removeEventListener('hashchange', fromUrl);
    };
  }, []);

  // a new step stops reading the old one; it is opened, and the one moved on from is done
  useEffect(() => {
    stopReading();
    if (cur < 0) return;
    const sid = prefix + ids[cur]!;
    void record({ id: onceId('open:' + lesson + '/' + sid), type: 'step_open', lesson, step: sid });
    if (prev.current >= 0 && cur > prev.current) {
      const done = prefix + ids[prev.current]!;
      void record({ id: onceId('done:' + lesson + '/' + done), type: 'step_done', lesson, step: done });
    }
    if (ids[cur] === 'finish' && !prefix) {
      void record({ id: onceId('done:' + lesson + '/finish'), type: 'step_done', lesson, step: 'finish' });
      void reward('finish', 20);
    }
    prev.current = cur;
  }, [cur]);
  // the language is a preference that follows the student to other devices
  useEffect(() => $lang.listen((l) => void record({ id: randomId(), type: 'prefs', lang: l })), []);
  const isDone = (id: string) => !!progress.steps[prefix + id]?.done;
  const listen = () => {
    if (!scroll && steps[Math.max(0, cur)]?.id === 'story') window.dispatchEvent(new Event(STORY_VOICE_EVENT));
    else toggleReading();
  };
  const speaking = reading.on && !reading.paused;
  const listenLabel = speaking ? L(UI.pauseReading) : L(UI.readAloud);

  const toggleView = () => {
    const on = document.documentElement.hasAttribute('data-player');      // one step at a time now -> whole lesson
    setScroll(on);
    setWholePage(on);
    if (!on) show(ids[Math.max(0, cur)]!);
    dlg.current?.close();
  };
  const open = (i: number) => {
    dlg.current?.close();
    if (scroll) {
      document.getElementById(ids[i]!)?.scrollIntoView({ block: 'start' });
      history.pushState(null, '', '#' + ids[i]);
    } else go(i);
  };

  const i = Math.max(0, cur);
  const step = steps[i];
  return (
    <>
      <nav class="lbar" aria-label={L(UI.steps)}>
        {!scroll && (
          <button type="button" class="lb-btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label={L(UI.previous)} title={L(UI.previous)}>
            <Svg d={BACK} />
          </button>
        )}
        {tts && (
          <button type="button" class={'lb-btn lb-listen' + (reading.on ? ' on' : '')} onClick={listen} aria-label={listenLabel} title={listenLabel}>
            <Svg d={speaking ? PAUSE : SPEAKER} />
          </button>
        )}
        <button type="button" class="lb-mid" aria-haspopup="dialog" onClick={() => dlg.current?.showModal()}>
          <Svg d={step && !scroll ? step.icon : MAP} />
          <span class="lb-title">{scroll || !step ? L(UI.map) : L(step.label)}</span>
          {!scroll && <span class="lb-count">{i + 1} / {steps.length}</span>}
        </button>
        {!scroll && (
          <button type="button" class="lb-btn primary" onClick={() => go(i + 1)} disabled={i >= steps.length - 1} aria-label={L(UI.next)} title={L(UI.next)}>
            <Svg d={NEXT} />
          </button>
        )}
      </nav>
      <dialog ref={dlg} class="lmap" aria-label={L(UI.map)} onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
        <div class="lm-in">
          <div class="lm-head">
            <h2>{L(UI.map)}</h2>
            <button type="button" class="btn btn-sm" onClick={() => dlg.current?.close()}>{L(UI.close)}</button>
          </div>
          {PHASES.map((ph) => {
            const list = steps.map((s, k) => ({ s, k })).filter(({ s }) => s.phase === ph.k);
            if (!list.length) return null;
            return (
              <section class="lm-phase" key={ph.k}>
                <h3>{L(ph.label)}</h3>
                <ol>
                  {list.map(({ s, k }) => (
                    <li key={s.id}>
                      <button type="button" class={'lm-step' + (isDone(s.id) ? ' done' : '')} aria-current={!scroll && k === i ? 'step' : undefined} onClick={() => open(k)}>
                        <Svg d={s.icon} />
                        <span>{L(s.label)}</span>
                        {isDone(s.id) && <span class="lm-tick" aria-label={L(UI.done)}>✓</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
          <button type="button" class="btn full" onClick={toggleView}>{L(scroll ? UI.oneStep : UI.wholePage)}</button>
        </div>
      </dialog>
    </>
  );
}
