import { useStore } from '@nanostores/preact';
import { $lang } from '../stores/prefs';
import { $step, go } from '../stores/lesson';
import { UI, pick, type StepInfo } from '../lib/lesson-ui';

/** Back / Next again at the end of the step, so nobody has to scroll back up (player.js "stem-end"). */
export default function StepEnd({ steps }: { steps: StepInfo[] }) {
  const lang = useStore($lang);
  const cur = useStore($step);
  if (cur < 0) return null;
  const next = steps[cur + 1];
  return (
    <nav class="lend" aria-label={pick(UI.steps, lang)}>
      <button type="button" class="btn" onClick={() => go(cur - 1)} disabled={cur === 0}>{pick(UI.back, lang)}</button>
      {next && (
        <button type="button" class="btn primary" onClick={() => go(cur + 1)}>
          {pick(UI.nextColon, lang)}{pick(next.label, lang)}
        </button>
      )}
    </nav>
  );
}
