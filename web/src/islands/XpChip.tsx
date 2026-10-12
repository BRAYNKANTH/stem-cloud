import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $reward, $xp } from '../stores/progress';

/** The student's XP in the header (progress v2), and a short "+10 XP" when a reward comes in (the current pages' toast). */
export default function XpChip() {
  const xp = useStore($xp);
  const reward = useStore($reward);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!reward) return;
    setShown(reward.amount);
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
  }, [reward?.n]);
  if (xp === null) return null;
  return (
    <span class="xp-chip" aria-live="polite">
      <span aria-hidden="true">⭐</span> <b>{xp}</b> XP
      {shown !== null && <span class="xp-plus">+{shown}</span>}
    </span>
  );
}
