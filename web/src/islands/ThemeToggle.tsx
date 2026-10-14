import { useEffect, useState } from 'preact/hooks';
import Ico from './Ico';

type Theme = 'light' | 'dark';

function current(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

const WORDS = { dark: ['Dark mode', 'இருண்ட தோற்றம்', 'අඳුරු පෙනුම'], light: ['Light mode', 'வெளிச்ச தோற்றம்', 'දීප්ත පෙනුම'] };

/**
 * Light / dark switch. Saved as stem_theme (public pages) and lessonTheme (lessons), so the whole app follows it.
 * An icon in a header; with text (lang: 0 English, 1 Tamil, 2 Sinhala) where there is room, as in the lesson map.
 */
export default function ThemeToggle({ text, lang = 0, className = 'theme-toggle' }: { text?: boolean; lang?: number; className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => setTheme(current()), []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const toggle = () => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('stem_theme', next);
      localStorage.setItem('lessonTheme', next);
    } catch {
      /* private mode: lasts for this page only */
    }
    setTheme(next);
  };
  if (text) {
    return (
      <button type="button" class={className} onClick={toggle}>
        <Ico name={next === 'dark' ? 'moon' : 'sun'} /> {WORDS[next][lang]}
      </button>
    );
  }
  return (
    <button type="button" class={className} onClick={toggle} aria-label={next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme'}>
      <Ico name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
