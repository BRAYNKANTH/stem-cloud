import { useEffect, useRef, useState } from 'preact/hooks';
import type { SiDict } from '../lib/si-lookup';
import { currentLesson, onceId, record, reward } from '../stores/progress';
import { useLabText, type Pair } from '../labs/shared';

/*
 * The lesson pages' sort game ("match + sort", the same code in every page; its data lifted by tools/sort_games.py into
 * games/sort/). Round 1: tap a term, then its meaning. Round 2: tap a chip, then the bin it belongs in. As on the page:
 * 5 XP for each right match and each chip sorted, and finishing the sort gives the page's own XP and badge; each once
 * (progress v2), and finishing counts as doing the step.
 */

export interface SortGameData {
  rounds: { title: Pair; hint: Pair }[];
  columns: [Pair, Pair];
  terms: { id: string; term: Pair; meaning: Pair }[];
  items: { id: string; text: Pair; bin: string }[];
  bins: { id: string; title: Pair }[];
  complete: { xp: number; message: Pair; badge: string };
}

/** A tile you tap (a div, styled as on the page), usable from the keyboard too. */
const act = (fn: () => void) => ({ role: 'button' as const, tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } });

const MATCHED: Pair = ['🎉 All matched!', '🎉 எல்லாமே சரி!'];
const SORTED: Pair = ['🎉 All chips sorted correctly!', '🎉 எல்லா சிப்பும் சரியா வரிசைப்படுத்தப்பட்டது!'];

/** Every fixed English string, for the Sinhala looked up at build time (labSinhala). */
export function sortStrings(g: SortGameData): string[] {
  return [MATCHED[0], SORTED[0], ...g.rounds.flatMap((r) => [r.title[0], r.hint[0]]), ...g.columns.map((c) => c[0]),
    ...g.terms.flatMap((t) => [t.term[0], t.meaning[0]]), ...g.items.map((i) => i.text[0]), ...g.bins.map((b) => b.title[0])];
}

export default function SortGame({ game, stepId = 'sort', si = {} }: { game: SortGameData; stepId?: string; si?: SiDict }) {
  const { lang, lookup } = useLabText(si);
  const html = (p: Pair) => ({ __html: lang === 'ta' ? p[1] : lang === 'si' ? lookup(p[0]) || p[0] : p[0] });
  const tx = (p: Pair) => (lang === 'ta' ? p[1] : lang === 'si' ? lookup(p[0]) || p[0] : p[0]);
  // the meanings in a random order, once per visit (as the page does); shuffled after the page has started, so the
  // built page and the running one agree (hydration does not redraw the tiles' text)
  const [order, setOrder] = useState(game.terms);
  useEffect(() => setOrder([...game.terms].sort(() => Math.random() - 0.5)), [game]);
  const [term, setTermState] = useState<string | null>(null);
  const [matched, setMatchedState] = useState<Set<string>>(() => new Set());
  const [chip, setChipState] = useState<string | null>(null);
  const [placed, setPlacedState] = useState<string[]>([]);
  // what the taps act on, current even when two taps come before the next render
  const now = useRef({ term: null as string | null, matched: new Set<string>(), chip: null as string | null, placed: [] as string[] });
  const setTerm = (v: string | null) => { now.current.term = v; setTermState(v); };
  const setMatched = (v: Set<string>) => { now.current.matched = v; setMatchedState(v); };
  const setChip = (v: string | null) => { now.current.chip = v; setChipState(v); };
  const setPlaced = (v: string[]) => { now.current.placed = v; setPlacedState(v); };
  const [wrong, setWrong] = useState<string | null>(null);
  const flash = (key: string) => { setWrong(key); setTimeout(() => setWrong((w) => (w === key ? null : w)), 400); };

  const pickMeaning = (id: string) => {
    const { term, matched } = now.current;
    if (matched.has(id) || !term) return;
    if (id !== term) return flash('m:' + id);
    const next = new Set(matched).add(id);
    setMatched(next);
    setTerm(null);
    void reward('sort:match-' + id, 5);
  };
  const place = (bin: string) => {
    const { chip, placed } = now.current;
    if (!chip) return;
    const it = game.items.find((i) => i.id === chip)!;
    if (it.bin !== bin) return flash('c:' + chip);
    const next = [...placed, chip];
    setPlaced(next);
    setChip(null);
    void reward('sort:chip-' + chip, 5);
    if (next.length === game.items.length) {
      void reward('sort:complete', game.complete.xp);
      const lesson = currentLesson();
      void record({ id: onceId('badge:' + game.complete.badge), type: 'badge', badge: game.complete.badge });
      if (lesson) void record({ id: onceId('done:' + lesson + '/' + stepId), type: 'step_done', lesson, step: stepId });
    }
  };

  const [r1, r2] = game.rounds as [SortGameData['rounds'][0], SortGameData['rounds'][0]];
  const allMatched = matched.size === game.terms.length, allSorted = placed.length === game.items.length;
  return (
    <div class="lab-card">
      <h3 style={{ marginBottom: '10px' }}>{tx(r1.title)}</h3>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', marginTop: '-6px' }}>{tx(r1.hint)}</p>
      <div class="match-grid">
        <div class="match-col">
          <div class="mtitle">{tx(game.columns[0])}</div>
          <div>
            {game.terms.map((t) => (
              <div data-id={t.id} class={'match-tile' + (matched.has(t.id) ? ' matched' : term === t.id ? ' selected' : '')}
                {...act(() => { if (!now.current.matched.has(t.id)) setTerm(t.id); })} dangerouslySetInnerHTML={html(t.term)} />
            ))}
          </div>
        </div>
        <div class="match-col">
          <div class="mtitle">{tx(game.columns[1])}</div>
          <div>
            {order.map((t) => (
              <div data-id={t.id} class={'match-tile' + (matched.has(t.id) ? ' matched' : wrong === 'm:' + t.id ? ' wrong' : '')}
                {...act(() => pickMeaning(t.id))} dangerouslySetInnerHTML={html(t.meaning)} />
            ))}
          </div>
        </div>
      </div>
      <div class={'game-result' + (allMatched ? ' win' : '')} data-result="match">{allMatched ? tx(MATCHED) : ''}</div>

      <h3 style={{ margin: '22px 0 6px' }}>{tx(r2.title)}</h3>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', marginTop: '-6px' }}>{tx(r2.hint)}</p>
      <div class="sort-pool">
        {game.items.filter((i) => !placed.includes(i.id)).map((i) => (
          <div data-id={i.id} class={'sort-chip' + (chip === i.id ? ' selected' : '') + (wrong === 'c:' + i.id ? ' wrong' : '')}
            {...act(() => setChip(i.id))} dangerouslySetInnerHTML={html(i.text)} />
        ))}
      </div>
      <div class="sort-bins">
        {game.bins.map((b) => (
          <div class="sort-bin" data-bin={b.id} {...act(() => place(b.id))}>
            <div class="btitle">{tx(b.title)}</div>
            <div>{placed.map((id) => game.items.find((i) => i.id === id)!).filter((i) => i.bin === b.id).map((i) => <span class="schip" dangerouslySetInnerHTML={html(i.text)} />)}</div>
          </div>
        ))}
      </div>
      <div class={'game-result' + (allSorted ? ' win' : '')} data-result="sort">{allSorted ? tx(SORTED) : ''}</div>
    </div>
  );
}
