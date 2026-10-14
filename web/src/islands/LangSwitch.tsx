import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, LANGS, loadPrefs, setLang, type Lang } from '../stores/prefs';

const LABEL: Record<Lang, string> = { en: 'English', ta: 'தமிழ்', si: 'සිංහල' };
const SHORT: Record<Lang, string> = { en: 'EN', ta: 'த', si: 'සි' };
const WORD: Record<Lang, string> = { en: 'Language', ta: 'மொழி', si: 'භාෂාව' };
const GLOBE = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z';

/**
 * The language choice, the same button on every page (as the current pages' #langToggle): a globe and the language,
 * which opens the three languages. Remembered on this device (and in the account). On a narrow header it shows the
 * short name (EN / த / සි).
 */
export default function LangSwitch() {
  const lang = useStore($lang);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(loadPrefs, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('click', away);
    document.addEventListener('keydown', key);
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    return () => { document.removeEventListener('click', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const choose = (l: Lang) => { setLang(l); setOpen(false); btn.current?.focus(); };
  return (
    <div class="langsw" ref={root}>
      <button ref={btn} type="button" class="langsw-btn" lang={lang} aria-haspopup="true" aria-expanded={open} aria-label={WORD[lang] + ': ' + LABEL[lang]} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={GLOBE} /></svg>
        <span class="langsw-name">{LABEL[lang]}</span><span class="langsw-short" aria-hidden="true">{SHORT[lang]}</span>
      </button>
      {open && (
        <div class="langsw-menu" role="group" aria-label={WORD[lang]}>
          {LANGS.map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => choose(l)}>
              {LABEL[l]}{lang === l && <span aria-hidden="true"> ✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
