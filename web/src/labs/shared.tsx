import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang } from '../stores/prefs';
import { makeH } from './engine';
import { makeLookup, type SiDict } from '../lib/si-lookup';
import { currentLesson, onceId, record, reward } from '../stores/progress';

/*
 * What every lesson page's lab has around its own simulation (the pages' "GUIDED LAB" and "CARTOON LAB STAGE" scripts,
 * the same in all of them): the guide (goal, what's in the picture, the tries, what to see, what is happening right
 * now) and the stage (Raja and Chittu drawn with the cartoon engine, and three missions). A ported lab gives its words,
 * its tries, its missions and its stage drawing, and keeps its simulation to itself.
 */

export type Pair = [string, string];

/** The words all the labs share (English, Tamil). */
export const SHARED = {
  title: ['🎯 How to use this lab', '🎯 இந்த லேப்ப எப்படி பயன்படுத்தறது'],
  see: ['What you should see: ', 'நீ பாக்கணும்: '],
  press: ['Press a "Try" button, and I will set the lab for you. Or move the sliders yourself.', '"Try" பட்டனை அழுத்து, நான் லேப்ப செட் பண்றேன். இல்லன்னா நீயே ஸ்லைடர நகர்த்து.'],
  now: ['Right now: ', 'இப்போ: '],
  stage: ['🎬 Lab stage: watch Raja and Chittu react', '🎬 லேப் மேடை: ராஜா, சிட்டு எப்படி ரியாக்ட் பண்றாங்கன்னு பாரு'],
  hint: ['Move the sliders below and complete the missions!', 'கீழ இருக்கற ஸ்லைடர நகர்த்தி மிஷன்கள முடி!'],
  play: ['▶ Play', '▶ ஓடு'],
  pause: ['⏸ Pause', '⏸ நிறுத்து'],
  reset: ['⟲ Reset', '⟲ மறுபடி'],
} satisfies Record<string, Pair>;

export interface Mission<S> { l: Pair; test: (s: S) => boolean }

/** The English strings of the shared words and of a lab's missions, for the Sinhala looked up at build time. */
export function sharedStrings(missions: Mission<any>[]): string[] {
  return [...Object.values(SHARED).map((p) => p[0]), ...missions.map((m, i) => 'Mission ' + (i + 1) + ': ' + m.l[0])];
}

/** The language, and tx([en, ta]) giving the text in it (Sinhala from the lab's part of the translation memory). */
export function useLabText(si: SiDict) {
  const lang = useStore($lang);
  const lookup = useMemo(() => makeLookup(si), [si]);
  const tx = (p: Pair) => (lang === 'ta' ? p[1] : lang === 'si' ? lookup(p[0]) || p[0] : p[0]);
  return { lang, lookup, tx };
}
export type LabText = ReturnType<typeof useLabText>;

/** Doing the lab: the lab step of the lesson counts as done (once). */
export function markLab() {
  const lesson = currentLesson();
  if (lesson) void record({ id: onceId('done:' + lesson + '/lab'), type: 'step_done', lesson, step: 'lab' });
}

/**
 * The missions: done ones are kept on this device under the current page's keys (scx_lab_<legacy>_<n>), so a mission
 * done on either page shows on both. Checked whenever deps change once the student has touched the lab; 5 XP each and
 * 10 more for all, once (progress v2).
 */
export function useMissions<S>(legacy: string, missions: Mission<S>[], state: () => S, deps: unknown[]) {
  const [done, setDone] = useState<boolean[]>(() => missions.map(() => false));
  const touched = useRef(false);
  useEffect(() => {
    setDone(missions.map((_, i) => { try { return localStorage.getItem(`scx_lab_${legacy}_${i}`) === '1'; } catch { return false; } }));
  }, []);
  useEffect(() => {
    if (!touched.current) return;
    const S = state();
    missions.forEach((m, i) => {
      if (done[i]) return;
      let ok = false;
      try { ok = m.test(S); } catch { /* not yet */ }
      if (!ok) return;
      setDone((d) => {
        const next = d.map((x, k) => x || k === i);
        if (next.every(Boolean)) void reward('lab:all-missions', 10);
        return next;
      });
      try { localStorage.setItem(`scx_lab_${legacy}_${i}`, '1'); } catch { /* private mode */ }
      void reward('lab:mission-' + (i + 1), 5);
      markLab();
    });
  }, deps);
  return { done, touch: () => { touched.current = true; } };
}

/** The guide: goal, the picture, the tries, what to see after a try, and what is happening now. */
export function LabGuide({ tx, goal, look, tries, chosen, onTry, now }: {
  tx: (p: Pair) => string; goal: Pair; look: Pair; tries: { l: Pair; see: Pair }[]; chosen: number; onTry: (i: number) => void; now: Pair | null;
}) {
  const see = chosen >= 0 ? tries[chosen]!.see : null;
  return (
    <div class="lg">
      <h4>{tx(SHARED.title)}</h4>
      <div class="goal">{tx(goal)}</div>
      <div class="look">{tx(look)}</div>
      <div class="lg-tries">
        {tries.map((tr, i) => <button type="button" class={'lg-try' + (i === chosen ? ' on' : '')} onClick={() => onTry(i)}>{i + 1}. {tx(tr.l)}</button>)}
      </div>
      <div class="lg-see">{see ? <>👀 <b>{tx(SHARED.see)}</b>{tx(see)}</> : <>👆 {tx(SHARED.press)}</>}</div>
      <div class="lg-live">{now && <>💬 <b>{tx(SHARED.now)}</b>{tx(now)}</>}</div>
    </div>
  );
}

/**
 * The stage: draw(t, H) is called about 30 times a second while it is on screen (with the state the lab keeps in a
 * ref), and once per change of deps when animations are off. Then the missions.
 */
export function LabStage<S>({ text, draw, missions, done, deps }: {
  text: LabText; draw: (t: number, H: any) => void; missions: Mission<S>[]; done: boolean[]; deps: unknown[];
}) {
  const { lang, lookup, tx } = text;
  const stage = useRef<SVGSVGElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const svg = stage.current;
    if (!svg) return;
    const H = makeH(svg, 640, 300, lang, lookup);
    const t0 = performance.now();
    let vis = false, raf = 0, last = 0;
    const calm = () => document.documentElement.classList.contains('stem-calm');
    const paint = () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      H._defs = H.E('defs', {});
      try { drawRef.current((performance.now() - t0) / 1000, H); } catch (e) { console.warn('lab stage', e); }
    };
    const loop = (ts: number) => {
      if (!vis) return;
      if (ts - last >= 32) { last = ts; paint(); }
      if (!calm()) raf = requestAnimationFrame(loop);
    };
    paint();
    svg.addEventListener('repaint', paint);
    const io = new IntersectionObserver((es) => es.forEach((e) => { const was = vis; vis = e.isIntersecting; if (vis && !was) raf = requestAnimationFrame(loop); }), { threshold: 0.1 });
    io.observe(svg);
    return () => { io.disconnect(); cancelAnimationFrame(raf); svg.removeEventListener('repaint', paint); };
  }, [lang]);
  // when animations are off the loop does not run: draw each change
  useEffect(() => {
    if (document.documentElement.classList.contains('stem-calm')) stage.current?.dispatchEvent(new Event('repaint'));
  }, deps);
  return (
    <div class="ls">
      <div class="ls-top"><b>{tx(SHARED.stage)}</b><span class="ls-hint">{tx(SHARED.hint)}</span></div>
      <svg ref={stage} viewBox="0 0 640 300" role="img" aria-label="lab cartoon" />
      <div class="ls-miss">
        {missions.map((m, i) => <div class={'ls-m' + (done[i] ? ' ok' : '')}><span class="ck">✓</span>{tx(['Mission ' + (i + 1) + ': ' + m.l[0], 'மிஷன் ' + (i + 1) + ': ' + m.l[1]])}</div>)}
      </div>
    </div>
  );
}

/** The readouts row. */
export function Readouts({ items }: { items: [string, string, string][] }) {
  return (
    <div class="lab-readouts">
      {items.map(([label, value, key]) => <div class="readout"><span class="ro-label">{label}</span><span class="ro-value" data-ro={key}>{value}</span></div>)}
    </div>
  );
}

/** The range of fn over [0, tmax] sampled 60 times, always including 0 (the lesson pages' sampleRange). */
export function range(fn: (t: number) => number, tmax: number): [number, number] {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i <= 60; i++) { const v = fn(tmax * i / 60); min = Math.min(min, v); max = Math.max(max, v); }
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  if (min === max) { min -= 1; max += 1; }
  return [min, max];
}

/** A graph against time, as the lesson pages draw it (drawGraph). */
export function Graph({ fn, t, label, tmax }: { fn: (t: number) => number; t: number; label: string; tmax: number }) {
  const [vmin, vmax] = range(fn, tmax);
  const x0 = 44, x1 = 280, ytop = 14, ybot = 180;
  const mx = (tt: number) => x0 + tt / tmax * (x1 - x0), my = (v: number) => ybot - (v - vmin) / (vmax - vmin) * (ybot - ytop);
  let d = '';
  for (let i = 0; i <= 60; i++) { const tt = tmax * i / 60; d += (i ? 'L' : 'M') + mx(tt).toFixed(1) + ' ' + my(fn(tt)).toFixed(1) + ' '; }
  return (
    <svg viewBox="0 0 300 220" width="100%" aria-hidden="true">
      <line x1={x0} y1={ybot} x2={x1} y2={ybot} style={{ stroke: 'var(--border)' }} stroke-width="1.5" />
      <line x1={x0} y1={ytop} x2={x0} y2={ybot} style={{ stroke: 'var(--border)' }} stroke-width="1.5" />
      {vmin < 0 && vmax > 0 && <line x1={x0} y1={my(0)} x2={x1} y2={my(0)} style={{ stroke: 'var(--border)' }} stroke-width="1" stroke-dasharray="3 3" />}
      <path d={d} fill="none" style={{ stroke: 'var(--accent-2)' }} stroke-width="2.5" />
      <circle cx={mx(t)} cy={my(fn(t))} r="5.5" style={{ fill: 'var(--accent)' }} />
      <text x={x1 - 30} y={ybot + 22} font-size="11" style={{ fill: 'var(--text-faint)' }}>t (s)</text>
      <text x="2" y={ytop + 6} font-size="11" style={{ fill: 'var(--text-faint)' }}>{label}</text>
      <text x="6" y={ybot + 4} font-size="10" style={{ fill: 'var(--text-faint)' }}>{vmin.toFixed(0)}</text>
      <text x="6" y={ytop + 10} font-size="10" style={{ fill: 'var(--text-faint)' }}>{vmax.toFixed(0)}</text>
    </svg>
  );
}

/** Playing time forward in real time up to tmax: step(dt) advances the lab; returns false to stop. */
export function usePlayer(playing: boolean, setPlaying: (p: boolean) => void, step: (dt: number) => boolean) {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!playing) return;
    let last: number | null = null, raf = 0;
    const tick = (now: number) => {
      if (last === null) last = now;
      const dt = (now - last) / 1000;
      last = now;
      if (!stepRef.current(dt)) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
