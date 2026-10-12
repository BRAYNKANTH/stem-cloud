// Reveal buttons inside the lesson content (the lesson pages' "STEP-REVEAL FOR SAMPLE QUESTIONS" script): a worked
// example shows its marking steps one at a time, then "Show final answer". Each language has its own copy of an example
// (components/lesson/T.astro), so what is revealed is kept per example and applied to every copy, and switching
// language keeps the student's place. Without JavaScript everything is shown (styles/lesson.css).
// The activities' "I tried it! (+XP)" buttons wait for progress v2 (Phase 6) and stay hidden until then.

const shown = new Map<string, number>();      // example id -> marking steps revealed (steps + 1 = final answer shown too)

function apply(card: HTMLElement, n: number): void {
  for (const wrap of card.querySelectorAll<HTMLElement>('[data-qcard]')) {
    const steps = [...wrap.querySelectorAll<HTMLElement>(':scope > .step')];
    steps.forEach((step, i) => {
      step.hidden = i > n;
      step.querySelector('.step-content')?.classList.toggle('hidden', i >= n);
      const t = step.querySelector<HTMLElement>('.step-toggle');
      if (t) t.hidden = i < n;
    });
    const box = wrap.parentElement ?? card;
    box.querySelector('.final-toggle')?.classList.toggle('hidden', n !== steps.length);
    box.querySelector('.final-answer')?.classList.toggle('hidden', n <= steps.length);
  }
}

function setUp(): void {
  for (const card of document.querySelectorAll<HTMLElement>('.lc .qcard[data-ex]')) apply(card, 0);
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('.lc .step-toggle, .lc .final-toggle');
    const card = btn?.closest<HTMLElement>('.qcard[data-ex]');
    if (!btn || !card) return;
    const id = card.dataset.ex!;
    const n = shown.get(id) ?? 0;
    shown.set(id, n + 1);
    apply(card, n + 1);
  });
}

setUp();
