import { useEffect, useRef } from 'preact/hooks';
import type { SiDict } from '../lib/si-lookup';
import { makeH } from '../labs/engine';
import { useLabText } from '../labs/shared';
import { currentLesson, onceId, record, reward } from '../stores/progress';

/*
 * A lesson's Watch animation: its page's own card and player script, unchanged (lifted by tools/watch_anims.py into
 * watch/), run inside the island with what it used from its page:
 *  - window.__fwMakeH: the cartoon engine (labs/engine.js) in the student's language;
 *  - window.STEM_LANG and window.StemSI: Sinhala from the translation memory, for its T(en, ta);
 *  - SCX.addXP: 3 XP for each right prediction, once (progress v2); confetti is left out;
 *  - document.getElementById looks inside the card; Tamil comes from the markup's data-ta, as the page does.
 * Reaching the end of the animation counts as watching the step (as player.js does). A change of language starts the
 * animation again in that language. The player itself is loaded (import()) only once the step is on screen.
 * A topic page shows one slice of it (seg: from, to, duration in seconds), kept inside that slice as public/static/embed.js does.
 */

export interface WatchModule {
  STRINGS: string[];
  run: (root: HTMLElement, env: { APP_LANG: string; window: Record<string, unknown>; SCX: { addXP: (n: number) => void; confettiBurst: () => void } }) => void;
}

export default function WatchAnim({ html, load, si = {}, stepId = 'watch', seg }: { html: string; load: () => Promise<WatchModule>; si?: SiDict; stepId?: string; seg?: [number, number, number] }) {
  const { lang, lookup } = useLabText(si);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = root.current;
    if (!box) return;
    let gone = false, end: ReturnType<typeof setInterval> | undefined, slice: ReturnType<typeof setInterval> | undefined;
    void load().then((anim) => {
      if (gone) return;
      box.innerHTML = html;
      if (lang === 'ta') box.querySelectorAll<HTMLElement>('[data-ta]').forEach((e) => { e.innerHTML = e.getAttribute('data-ta') || e.innerHTML; });
      else if (lang === 'si') box.querySelectorAll<HTMLElement>('[data-ta]').forEach((e) => { const r = lookup(e.innerHTML); if (r) e.innerHTML = r; });
      let predictions = 0;
      const env = {
        APP_LANG: lang === 'ta' ? 'ta' : 'en',
        window: {
          STEM_LANG: lang === 'si' ? 'si' : '',
          StemSI: { t: (en: string) => lookup(en) || en },
          __fwMakeH: (svg: SVGSVGElement, VW: number, VH: number) => makeH(svg, VW, VH, lang, lookup),
          __fwMark: () => {},
          AudioContext: (globalThis as any).AudioContext,
          webkitAudioContext: (globalThis as any).webkitAudioContext,
        },
        SCX: {
          addXP: (n: number) => { void reward('watch:prediction-' + ++predictions, n); },
          confettiBurst: () => {},
        },
      };
      try { anim.run(box, env); } catch (e) { console.warn('watch script', e); }
      if (seg) {
        // one slice of the animation (a topic page): start at its beginning, stay inside it, stop at its end
        const [from, to, dur] = seg, paintAt = (env.window as Record<string, unknown>).__fwPaint as ((t: number) => void) | undefined;   // set by the player
        const scrub = box.querySelector<HTMLInputElement>('#fw_scrub'), play = box.querySelector<HTMLButtonElement>('#fw_play');
        const rep = box.querySelector<HTMLElement>('#fw_rep');
        if (rep) rep.style.display = 'none';                     // "Replay" would play the whole animation
        if (!paintAt || !scrub || !play) return;
        const now = () => (+scrub.value) * dur / 1000, playing = () => /⏸/.test(play.textContent || '');
        paintAt(from);
        // Play on a finished slice starts it again from its beginning (before the player's own handler)
        play.addEventListener('click', () => { if (!playing() && now() >= to - 0.05) paintAt(from); }, true);
        scrub.addEventListener('input', () => { const t = now(); if (t < from) paintAt(from); else if (t > to) paintAt(to); });
        slice = setInterval(() => {
          const t = now();
          if (t >= to - 0.02) { if (playing()) play.click(); if (t > to) paintAt(to); }
          else if (t < from - 0.02) paintAt(from);
        }, 100);
        return;                                                    // a slice is not the lesson's Watch step
      }
      // the end of the animation counts as watching it (player.js: the time slider at its end)
      end = setInterval(() => {
        const s = box.querySelector<HTMLInputElement>('#fw_scrub');
        const lesson = currentLesson();
        if (s && +s.value >= 995 && lesson) {
          void record({ id: onceId('done:' + lesson + '/' + stepId), type: 'step_done', lesson, step: stepId });
          clearInterval(end);
        }
      }, 800);
    });
    return () => { gone = true; clearInterval(end); clearInterval(slice); };
  }, [lang, lookup]);

  return <div ref={root} class="watch-anim" dangerouslySetInnerHTML={{ __html: html }} />;
}
