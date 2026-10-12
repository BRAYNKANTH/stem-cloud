import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';
import { $ids, $step, go, show, stepFromHash, setWholePage, wholePage } from '../stores/lesson';
import { PHASES, UI, pick, type StepInfo } from '../lib/lesson-ui';

const BACK = 'M15 6l-6 6 6 6';
const NEXT = 'M5 12h14M13 6l6 6-6 6';
const MAP = 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14';

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
 */
export default function LessonPlayer({ steps }: { steps: StepInfo[] }) {
  const lang = useStore($lang);
  const cur = useStore($step);
  const [scroll, setScroll] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const ids = steps.map((s) => s.id);

  useEffect(() => {
    loadPrefs();
    $ids.set(ids);
    setScroll(wholePage());
    const fromUrl = () => go(stepFromHash(ids), false);
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    window.addEventListener('hashchange', fromUrl);
    return () => {
      window.removeEventListener('popstate', fromUrl);
      window.removeEventListener('hashchange', fromUrl);
    };
  }, []);

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
  const L = (t: Parameters<typeof pick>[0]) => pick(t, lang);
  return (
    <>
      <nav class="lbar" aria-label={L(UI.steps)}>
        {!scroll && (
          <button type="button" class="lb-btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label={L(UI.previous)} title={L(UI.previous)}>
            <Svg d={BACK} />
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
                      <button type="button" class="lm-step" aria-current={!scroll && k === i ? 'step' : undefined} onClick={() => open(k)}>
                        <Svg d={s.icon} />
                        <span>{L(s.label)}</span>
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
