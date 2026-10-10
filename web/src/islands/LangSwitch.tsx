import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, LANGS, loadPrefs, setLang, type Lang } from '../stores/prefs';

const LABEL: Record<Lang, string> = { en: 'English', ta: 'தமிழ்', si: 'සිංහල' };

/** Language choice: English / Tamil / Sinhala, remembered on this device. */
export default function LangSwitch() {
  const lang = useStore($lang);
  useEffect(loadPrefs, []);
  return (
    <div role="group" aria-label="Language" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {LANGS.map((l) => (
        <button key={l} type="button" className="btn" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
