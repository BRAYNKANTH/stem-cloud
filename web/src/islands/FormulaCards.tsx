import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, loadPrefs } from '../stores/prefs';

type Tri = { en: string; ta: string; si: string };
export interface Card {
  id: string; lesson: string; box: string | null; name: Tri; math: string | Tri;
  symbols: { s: string; en: string; ta: string; si: string; unit: string }[]; worked: Tri; tip?: Tri;
}
export interface Chapter { id: string; slug: string; grade: number; number: string; title: Tri; url: string; papers: string }

const W = {
  title: { en: 'Formula cards', ta: 'சூத்திர அட்டைகள்', si: 'සූත්‍ර කාඩ්පත්' },
  sub: { en: 'formulas of O/L Physics, each with its units and a worked example.', ta: 'O/L பௌதிகச் சூத்திரங்கள், ஒவ்வொன்றும் அலகுகளுடனும் ஓர் உதாரணத்துடனும்.', si: 'O/L භෞතික විද්‍යා සූත්‍ර, එක් එක් ඒකක සහ විසඳූ උදාහරණයක් සමඟ.' },
  all: { en: 'All', ta: 'எல்லாம்', si: 'සියල්ල' },
  chapter: { en: 'Chapter', ta: 'பாடம்', si: 'පරිච්ඡේදය' },
  grade: { en: 'Grade', ta: 'தரம்', si: 'ශ්‍රේණිය' },
  cards: { en: 'Cards', ta: 'அட்டைகள்', si: 'කාඩ්පත්' },
  list: { en: 'List', ta: 'பட்டியல்', si: 'ලැයිස්තුව' },
  view: { en: 'View', ta: 'காட்சி', si: 'දර්ශනය' },
  test: { en: 'Test me', ta: 'என்னைச் சோதி', si: 'මාව පරීක්ෂා කරන්න' },
  testOn: { en: 'Each formula is hidden: say it, then tap to check.', ta: 'ஒவ்வொரு சூத்திரமும் மறைந்துள்ளது: சொல்லிவிட்டுத் தொட்டுச் சரிபார்.', si: 'සෑම සූත්‍රයක්ම සඟවා ඇත: එය කියා, පසුව තට්ටු කර පරීක්ෂා කරන්න.' },
  show: { en: 'Show the formula', ta: 'சூத்திரத்தைக் காட்டு', si: 'සූත්‍රය පෙන්වන්න' },
  symbol: { en: 'Symbol', ta: 'குறியீடு', si: 'සංකේතය' },
  means: { en: 'Means', ta: 'கருத்து', si: 'අර්ථය' },
  unit: { en: 'Unit', ta: 'அலகு', si: 'ඒකකය' },
  example: { en: 'Example', ta: 'உதாரணம்', si: 'උදාහරණය' },
  learn: { en: 'Learn it in the lesson', ta: 'பாடத்தில் கற்றுக்கொள்', si: 'පාඩමේදී ඉගෙන ගන්න' },
  papers: { en: 'Past paper questions', ta: 'கடந்த வினாத்தாள் வினாக்கள்', si: 'පසුගිය ප්‍රශ්න පත්‍ර ප්‍රශ්න' },
  prev: { en: 'Previous card', ta: 'முந்தைய அட்டை', si: 'පෙර කාඩ්පත' },
  next: { en: 'Next card', ta: 'அடுத்த அட்டை', si: 'ඊළඟ කාඩ්පත' },
  of: { en: 'of', ta: '/', si: '/' },
};

/** A bare chapter slug in the address (#hydrostatic-pressure) chooses the chapter; anything else shows them all. */
const fromHash = (chapters: Chapter[]) => {
  const h = decodeURIComponent(location.hash.slice(1));
  return chapters.some((c) => c.slug === h) ? h : '';
};

/**
 * The formula cards: every formula of the lessons (content/formulas/physics.json), one card at a time in a deck that
 * swipes (or Previous / Next, or the arrow keys), or all in a list. A chapter can be chosen (#<chapter> in the
 * address, which the lesson's step bar links to). "Test me" hides each formula until it is tapped.
 */
export default function FormulaCards({ cards, chapters }: { cards: Card[]; chapters: Chapter[] }) {
  const lang = useStore($lang);
  const t = (x: Tri | string) => (typeof x === 'string' ? x : x[lang] || x.en);
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'cards' | 'list'>('cards');
  const [test, setTest] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [at, setAt] = useState(0);
  const deck = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  useEffect(() => {
    loadPrefs();
    const sync = () => setSlug(fromHash(chapters));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const list = useMemo(() => {
    const order = new Map(chapters.map((c, i) => [c.id, i]));
    const ch = chapters.find((c) => c.slug === slug);
    return cards.filter((c) => !ch || c.lesson === ch.id).sort((a, b) => (order.get(a.lesson) ?? 99) - (order.get(b.lesson) ?? 99));
  }, [slug, cards]);
  const withCards = chapters.filter((c) => cards.some((k) => k.lesson === c.id));

  // a new chapter starts at its first card, and its chip is in view in the row of chapters
  useEffect(() => {
    setAt(0);
    deck.current?.scrollTo({ left: 0 });
    const chip = document.querySelector<HTMLElement>('.fc-chips [aria-pressed="true"]');
    const row = chip?.parentElement;
    if (chip && row) row.scrollTo({ left: chip.offsetLeft - row.offsetLeft - 16 });
  }, [slug, mode]);
  // the card in view, for "3 of 12"
  useEffect(() => {
    const el = deck.current;
    if (!el || mode !== 'cards') return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.i)); }), { root: el, threshold: 0.6 });
    el.querySelectorAll('.fc-card').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [list, mode]);

  const choose = (s: string) => {
    history.replaceState(null, '', s ? '#' + s : location.pathname);
    setSlug(s);
  };
  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(list.length - 1, i));
    const card = deck.current?.querySelectorAll<HTMLElement>('.fc-card')[n];
    if (!card || !deck.current) return;
    const calm = document.documentElement.classList.contains('stem-calm');
    deck.current.scrollTo({ left: card.offsetLeft - deck.current.offsetLeft, behavior: calm ? 'auto' : 'smooth' });
    setAt(n);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(at + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(at - 1); }
  };
  const chapterLine = (c?: Chapter) => (c ? `${t(W.grade)} ${c.grade} · ${t(W.chapter)} ${c.number} · ${t(c.title)}` : '');
  const reveal = (id: string) => setShown(new Set([...shown, id]));

  const body = (c: Card) => {
    const hidden = test && !shown.has(c.id);
    const ch = byId.get(c.lesson);
    return (
      <>
        <p class="fc-chap">{chapterLine(ch)}</p>
        <h2 class="fc-name">{t(c.name)}</h2>
        {hidden ? (
          <button type="button" class="btn fc-reveal" onClick={() => reveal(c.id)}>{t(W.show)}</button>
        ) : (
          <>
            <p class="fc-math">{t(c.math)}</p>
            {c.symbols.length > 0 && (
              <table class="fc-sym">
                <thead><tr><th scope="col">{t(W.symbol)}</th><th scope="col">{t(W.means)}</th><th scope="col">{t(W.unit)}</th></tr></thead>
                <tbody>{c.symbols.map((s) => <tr><th scope="row">{s.s}</th><td>{s[lang] || s.en}</td><td class="fc-unit">{s.unit}</td></tr>)}</tbody>
              </table>
            )}
            <p class="fc-ex"><b>{t(W.example)}</b> {t(c.worked)}</p>
            {c.tip && <p class="fc-tip"><span aria-hidden="true">💡</span> {t(c.tip)}</p>}
          </>
        )}
        {ch && (
          <p class="fc-links">
            <a href={ch.url + '#notes'}>{t(W.learn)} →</a>
            <a href={'/past-papers/#chapter/' + ch.papers}>{t(W.papers)} →</a>
          </p>
        )}
      </>
    );
  };

  return (
    <div class="fc">
      <h1>{t(W.title)}</h1>
      <p class="fc-lead">{cards.length} {t(W.sub)}</p>

      <div class="fc-chips" role="group" aria-label={t(W.chapter)}>
        <button type="button" aria-pressed={!slug} onClick={() => choose('')}>{t(W.all)}</button>
        {withCards.map((c) => (
          <button type="button" aria-pressed={slug === c.slug} onClick={() => choose(c.slug)}>
            <small>{c.grade}·{c.number}</small> {t(c.title)}
          </button>
        ))}
      </div>

      <div class="fc-tools">
        <div class="fc-seg" role="group" aria-label={t(W.view)}>
          <button type="button" aria-pressed={mode === 'cards'} onClick={() => setMode('cards')}>{t(W.cards)}</button>
          <button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>{t(W.list)}</button>
        </div>
        <button type="button" class="btn fc-test" aria-pressed={test} onClick={() => { setTest(!test); setShown(new Set()); }}>{t(W.test)}</button>
      </div>
      {test && <p class="fc-note" role="status">{t(W.testOn)}</p>}

      {mode === 'cards' ? (
        <>
          <div class="fc-deck" ref={deck} tabIndex={0} onKeyDown={key} aria-roledescription="carousel" aria-label={t(W.title)}>
            {list.map((c, i) => (
              <article class="fc-card" data-i={i} key={c.id} aria-roledescription="card" aria-label={`${i + 1} ${t(W.of)} ${list.length}: ${t(c.name)}`}>
                {body(c)}
              </article>
            ))}
          </div>
          <div class="fc-pager">
            <button type="button" class="btn" onClick={() => goTo(at - 1)} disabled={at === 0} aria-label={t(W.prev)}>←</button>
            <span class="fc-count" aria-live="polite">{at + 1} {t(W.of)} {list.length}</span>
            <button type="button" class="btn primary" onClick={() => goTo(at + 1)} disabled={at >= list.length - 1} aria-label={t(W.next)}>→</button>
          </div>
        </>
      ) : (
        <ol class="fc-list">
          {list.map((c) => <li class="fc-card fc-row" key={c.id}>{body(c)}</li>)}
        </ol>
      )}
    </div>
  );
}
