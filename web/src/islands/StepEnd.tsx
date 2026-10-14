import { useStore } from '@nanostores/preact';
import { $lang } from '../stores/prefs';
import { $step, go } from '../stores/lesson';
import { UI, pick, type StepInfo } from '../lib/lesson-ui';

/** Back / Next: the lesson's one pager, sticky at the bottom of the screen in thumb reach (player.js "stem-end"). */
export default function StepEnd({ steps }: { steps: StepInfo[] }) {
  const lang = useStore($lang);
  const cur = useStore($step);
  if (cur < 0) return null;
  const next = steps[cur + 1];
  return (
    <nav class="lend" aria-label={pick(UI.stepNav, lang)}>
      <button type="button" class="btn" onClick={() => go(cur - 1)} disabled={cur === 0}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        {pick(UI.back, lang)}
      </button>
      {next && (
        <button type="button" class="btn primary" onClick={() => go(cur + 1)}>
          {pick(UI.nextColon, lang)}{pick(next.label, lang)}
        </button>
      )}
    </nav>
  );
}
