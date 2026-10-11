import { useEffect, useState } from 'preact/hooks';
import Ico from './Ico';

type Theme = 'light' | 'dark';

function current(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Light / dark switch. Saved as stem_theme (public pages) and lessonTheme (lessons), so the whole app follows it. */
export default function ThemeToggle() {
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
  return (
    <button type="button" class="theme-toggle" onClick={toggle} aria-label={next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme'}>
      <Ico name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
