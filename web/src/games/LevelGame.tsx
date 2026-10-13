import { useEffect, useRef } from 'preact/hooks';
import type { SiDict } from '../lib/si-lookup';
import { useLabText } from '../labs/shared';
import { currentLesson, onceId, record, reward } from '../stores/progress';

/*
 * The six one-off level games (motion's and Newton's hold games, push-it, tug of war, the balance game, equilibrium's
 * hold game), each its page's own markup and script, unchanged (lifted by tools/level_games.py into games/levels/).
 * This shows the markup and runs the script on it, giving it what it used from its page:
 *  - el and cssVar (SVG elements, the colours read from the game);
 *  - safeGet and safeSet (this device's storage: the best stars stay under the page's key, scx_<game>_stars);
 *  - SCX.pushItLevelResult(stars, all): 10 XP a star for each better result, once; the best stars per level on the
 *    account as <lesson>/<step> (progress v2, where the current pages' stars already go); the page's badge for every
 *    level; a cleared level counts as playing the step (as player.js does);
 *  - the language: Tamil from the markup's data-ta, as the page does; Sinhala looked up in the translation memory
 *    for every text the game shows, as si.js does. A change of language starts the game again in that language.
 */

export interface LevelGameModule {
  HTML: string;
  META: { lesson: string; step: string; starsKey: string; badge: string; hook: string | null };
  STRINGS: string[];
  run: (root: HTMLElement, env: {
    APP_LANG: string; el: (tag: string, attrs: Record<string, unknown>) => SVGElement; cssVar: (name: string) => string;
    safeGet: (k: string) => string | null; safeSet: (k: string, v: string) => void;
    SCX: { pushItLevelResult: (stars: number, all: boolean) => void; sndWrong: () => void; sndCorrect: () => void };
  }) => { lang: (() => void) | null };
}

const SVGNS = 'http://www.w3.org/2000/svg';
const stored = (key: string): number[] => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export default function LevelGame({ game, si = {} }: { game: LevelGameModule; si?: SiDict }) {
  const { META } = game;
  const { lang, lookup } = useLabText(si);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = root.current;
    if (!box) return;
    box.innerHTML = game.HTML;
    // the markup in the student's language: Tamil from data-ta (as the page's applyLang does)
    if (lang === 'ta') box.querySelectorAll<HTMLElement>('[data-ta]').forEach((e) => { e.innerHTML = e.getAttribute('data-ta') || e.innerHTML; });
    // Sinhala: every text the game shows, now and as it changes (as si.js does)
    let mo: MutationObserver | null = null;
    const sinhala = (node: Node) => {
      const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        const v = t.nodeValue || '';
        const r = v.trim() ? lookup(v) : null;
        if (r && r !== v.trim()) t.nodeValue = v.replace(v.trim(), r);
      }
    };
    if (lang === 'si') {
      sinhala(box);
      mo = new MutationObserver((ms) => { mo!.disconnect(); ms.forEach((m) => sinhala(m.target)); mo!.observe(box, { subtree: true, childList: true, characterData: true }); });
      mo.observe(box, { subtree: true, childList: true, characterData: true });
    }
    let before = stored(META.starsKey);
    const env = {
      APP_LANG: lang === 'ta' ? 'ta' : 'en',
      el: (tag: string, attrs: Record<string, unknown>) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); return e; },
      cssVar: (name: string) => getComputedStyle(box).getPropertyValue(name).trim(),
      safeGet: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
      safeSet: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
      SCX: {
        // called when a level's best stars got better (the page has saved them already)
        pushItLevelResult: (stars: number, all: boolean) => {
          const now = stored(META.starsKey), lesson = currentLesson() || META.lesson;
          now.forEach((n, level) => {
            if (!(n > (before[level] || 0))) return;
            void record({ id: onceId('game:' + lesson + '/' + META.step + ':' + level + ':' + n), type: 'game', game: lesson + '/' + META.step, level, stars: n });
            void reward('game:level-' + (level + 1) + '-stars-' + n, n * 10);
          });
          before = now;
          if (stars > 0) void record({ id: onceId('done:' + lesson + '/' + META.step), type: 'step_done', lesson, step: META.step });
          if (all) void record({ id: onceId('badge:' + META.badge), type: 'badge', badge: META.badge });
        },
        sndWrong: () => {},
        sndCorrect: () => {},
      },
    };
    try { game.run(box, env); } catch (e) { console.warn('game script', e); }
    return () => { mo?.disconnect(); };
  }, [lang, lookup]);

  // built page: the game card as the page has it (in English), until the script starts
  return <div ref={root} class="level-game" dangerouslySetInnerHTML={{ __html: game.HTML }} />;
}
