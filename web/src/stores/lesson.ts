// The step a lesson page shows, shared by the step bar and the buttons at the end of the step. The steps are static
// HTML sections (<section class="lstep" id="...">); the player only says which one is shown. The URL hash names it
// (#quiz), so a step can be linked to and the browser's Back button steps back.
import { atom } from 'nanostores';

export const VIEW_KEY = 'stem_view';        // the current app's setting: "scroll" = whole lesson on one page

/** -1 until the player has read the URL. */
export const $step = atom<number>(-1);
export const $ids = atom<string[]>([]);

export function stepFromHash(ids: string[], aliases: Record<string, string> = {}): number {
  const raw = decodeURIComponent(location.hash.slice(1));
  // the current pages' section ids (#examples, #practice, ...) open the step they became (lesson.legacy.steps)
  const h = ids.includes(raw) ? raw : aliases[raw] ?? raw;
  const i = ids.indexOf(h);
  if (i >= 0) return i;
  // a link to something inside a step (#q3 in the notes) opens that step
  const el = h ? document.getElementById(h) : null;
  const sec = el?.closest('section.lstep');
  return sec ? Math.max(0, ids.indexOf(sec.id)) : 0;
}

/** Shows step i: marks its section, and records it in the URL as a new history entry (so Back returns here). */
export function go(i: number, push = true): void {
  const ids = $ids.get();
  if (i < 0 || i >= ids.length) return;
  $step.set(i);
  show(ids[i]!);
  if (push && location.hash !== '#' + ids[i]) history.pushState(null, '', '#' + ids[i]);
  const top = document.getElementById('lesson-top');
  if (top && push) top.scrollIntoView({ block: 'start' });
}

export function show(id: string): void {
  for (const s of document.querySelectorAll<HTMLElement>('section.lstep')) s.classList.toggle('on', s.id === id);
}

export function wholePage(): boolean {
  try {
    return localStorage.getItem(VIEW_KEY) === 'scroll';
  } catch {
    return false;
  }
}

export function setWholePage(on: boolean): void {
  try {
    if (on) localStorage.setItem(VIEW_KEY, 'scroll');
    else localStorage.removeItem(VIEW_KEY);
  } catch {
    /* private mode: for this page only */
  }
  document.documentElement.toggleAttribute('data-player', !on);
}
