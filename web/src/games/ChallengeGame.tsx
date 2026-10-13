import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SiDict } from '../lib/si-lookup';
import { makeDraw } from '../labs/slider/draw';
import { useLabText, type Pair } from '../labs/shared';
import { currentLesson, onceId, record, reward } from '../stores/progress';

/*
 * The challenge mini-game of the nine slider-lab pages, rebuilt (its levels and picture lifted from each page by
 * tools/challenge_games.py into games/challenge/). Each level is a question with a picture: set the slider to your
 * answer and check it, for up to three stars by how close it is. As on the page: the best stars per level are kept on
 * this device under the page's key (scx_<page>_stars), each better result gives 10 XP a star, and clearing every
 * level earns the page's badge; a level cleared counts as playing the step. On the account (progress v2) the best stars per level are the lesson's game step,
 * where the current pages' stars already go (stemcloud/progress_bridge.py).
 */

interface Level { correct: number; min?: number; max?: number; step?: number; start?: number; unit?: string; tol?: [number, number, number]; en: string; ta: string }
export interface ChallengeModule {
  META: { lesson: string; starsKey: string; badge: string; viewBox: string; hint: Pair; guess: Pair; check: Pair };
  STRINGS: string[];
  build: (TT: (p: Pair) => string) => {
    levels: Level[]; min: number; max: number; step: number; unit: string; tol: [number, number, number]; win: Pair; lose: Pair;
    scene: (D: any, level: Level, state: 'idle' | 'right' | 'wrong', guess: number, TT: (p: Pair) => string) => void;
  };
}

const stars3 = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export default function ChallengeGame({ game, si = {}, stepId = 'challenge' }: { game: ChallengeModule; si?: SiDict; stepId?: string }) {
  const { META } = game;
  const { lang, lookup, tx } = useLabText(si);
  const G = useMemo(() => game.build(tx), [lang, lookup]);
  const [cur, setCur] = useState(0);
  const lv = G.levels[cur]!;
  const range = { min: lv.min ?? G.min, max: lv.max ?? G.max, step: lv.step ?? G.step };
  const unit = lv.unit || G.unit;
  const [guess, setGuess] = useState(lv.start ?? range.min);
  const [state, setState] = useState<'idle' | 'right' | 'wrong'>('idle');
  const [stars, setStars] = useState(0);
  const [best, setBest] = useState<number[]>(() => G.levels.map(() => 0));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(META.starsKey) || '[]');
      if (Array.isArray(saved)) setBest(G.levels.map((_, i) => (typeof saved[i] === 'number' ? saved[i] : 0)));
    } catch { /* none yet */ }
  }, []);
  const open = (i: number) => {
    const l = G.levels[i]!;
    setCur(i); setGuess(l.start ?? l.min ?? G.min); setState('idle'); setStars(0);
  };

  // the picture
  const pic = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = pic.current;
    if (!svg) return;
    const D = makeDraw(svg, lang === 'si' ? lookup : null);
    D.clear();
    try { G.scene(D, lv, state, guess, tx); } catch (e) { console.warn('game picture', e); }
  }, [cur, state, guess, G]);

  const check = () => {
    const err = Math.abs(guess - lv.correct), tol = lv.tol || G.tol;
    const n = err <= tol[0] ? 3 : err <= tol[1] ? 2 : err <= tol[2] ? 1 : 0;
    setState(n > 0 ? 'right' : 'wrong');
    setStars(n);
    if (n > (best[cur] || 0)) {
      const next = best.map((b, i) => (i === cur ? n : b));
      setBest(next);
      try { localStorage.setItem(META.starsKey, JSON.stringify(next)); } catch { /* private mode */ }
      const lesson = currentLesson() || META.lesson;
      void record({ id: onceId('game:' + lesson + '/' + stepId + ':' + cur + ':' + n), type: 'game', game: lesson + '/' + stepId, level: cur, stars: n });
      void reward('game:level-' + (cur + 1) + '-stars-' + n, n * 10);
      // a level cleared counts as playing the game (as on the page, player.js)
      void record({ id: onceId('done:' + lesson + '/' + stepId), type: 'step_done', lesson, step: stepId });
      if (next.every((b) => b > 0)) void record({ id: onceId('badge:' + META.badge), type: 'badge', badge: META.badge });
    }
  };

  const result = state === 'idle' ? '' : tx(state === 'right' ? G.win : G.lose).replace('{ans}', lv.correct + ' ' + unit);
  return (
    <div class="lab-card">
      <div class="level-row">
        {G.levels.map((_, i) => (
          <div class={'level-btn' + (i === cur ? ' active' : '')} role="button" tabIndex={0} data-level={i}
            onClick={() => open(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } }}>
            <div class="lnum2">{i + 1}</div><div class="lstars">{stars3(best[i] || 0)}</div>
          </div>
        ))}
      </div>
      <div class="game-scene">
        <div class="surface-label" data-ro="question">{tx([lv.en, lv.ta])}</div>
        <svg ref={pic} viewBox={META.viewBox} width="100%" aria-hidden="true" />
        <div class="control" style={{ maxWidth: '400px', margin: '14px auto 0', textAlign: 'left' }}>
          <label for="gameGuessSlider"><span>{tx(META.guess)}</span> = <b data-ro="guess">{String(guess)}</b> <span>{unit}</span></label>
          <input type="range" id="gameGuessSlider" min={range.min} max={range.max} step={range.step} value={guess}
            onInput={(e) => { setGuess(parseFloat((e.target as HTMLInputElement).value)); setState('idle'); }} />
        </div>
        <div class="lab-buttons" style={{ justifyContent: 'center', display: 'flex', marginTop: '14px' }}>
          <button type="button" class="btn primary" onClick={check}>{tx(META.check)}</button>
        </div>
        <div class={'game-result' + (state === 'right' ? ' win' : state === 'wrong' ? ' lose' : '')} data-ro="result">{result}</div>
        <div class="star-row" data-ro="stars">{stars > 0 ? stars3(stars) : ''}</div>
      </div>
      <p class="lab-hint" dangerouslySetInnerHTML={{ __html: lang === 'ta' ? META.hint[1] : lang === 'si' ? lookup(META.hint[0]) || META.hint[0] : META.hint[0] }} />
    </div>
  );
}
