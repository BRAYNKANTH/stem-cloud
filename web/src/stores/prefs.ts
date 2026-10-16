// Student preferences shared by every island. They use the same localStorage keys as the current app
// (lessonLang, lessonTheme), so a choice made on an old page carries over to the new pages and back.
import { atom } from 'nanostores';

export type Lang = 'en' | 'ta' | 'si';
export const LANGS: readonly Lang[] = ['en', 'ta', 'si'];
const LANG_KEY = 'lessonLang';

function storedLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'ta' || v === 'si' ? v : 'en';
  } catch {
    return 'en';
  }
}

/** Starts as 'en' so server-rendered islands and their first client render agree; loadPrefs() then reads the device. */
export const $lang = atom<Lang>('en');

export function loadPrefs(): void {
  $lang.set(storedLang());
}

/** The Tamil / Sinhala fonts are not part of every page (see AppLayout): add the one for this language, once. */
function langFont(lang: Lang): void {
  const url = (window as unknown as { __langFonts?: Record<string, string> }).__langFonts?.[lang];
  if (!url || document.querySelector(`link[data-lang-font="${lang}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = url;
  l.setAttribute('data-lang-font', lang);
  document.head.appendChild(l);
}

export function setLang(lang: Lang): void {
  $lang.set(lang);
  langFont(lang);
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  document.documentElement.lang = lang;
}
