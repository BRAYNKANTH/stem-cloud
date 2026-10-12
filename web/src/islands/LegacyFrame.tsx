import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang } from '../stores/prefs';
import { UI, pick, type Tri } from '../lib/lesson-ui';

/**
 * A lab, game, sort game or animation that has not been rebuilt yet: that section of the current lesson page in a frame
 * (/lessons/<file>?embed=1#<hash>, docs/migration-plan-astro.md section 3.4). public/static/embed.js hides the page's
 * own header and bars there, leaves the lesson's bookmarks alone and reports the height, so the frame fits its content.
 * Loaded only when it is on screen (client:visible). The lesson page reads the language when it loads, so the frame is
 * reloaded when the language changes.
 */
export default function LegacyFrame({ file, hash, title }: { file: string; hash: string; title: Tri }) {
  const lang = useStore($lang);
  const frame = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(560);
  const src = `/lessons/${file}?embed=1#${hash}`;

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; event?: string; h?: number };
      if (d?.type === 'stem-embed' && d.event === 'height' && typeof d.h === 'number') setH(Math.min(Math.max(d.h, 200), 4000));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div class="lframe">
      <iframe ref={frame} key={lang} src={src} title={pick(title, lang)} loading="lazy" style={{ height: h + 'px' }} />
      <p class="lframe-alt"><a href={`/lessons/${file}#${hash}`}>{pick(UI.openFull, lang)}</a></p>
    </div>
  );
}
