import { useEffect, useRef, useState } from 'preact/hooks';
import Ico from './Ico';

/** Phone menu button for SiteNav: shows or hides the page links (data-open on the nav). Hidden on wider screens. */
export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const nav = ref.current?.closest('.site-nav');
    if (!nav) return;
    nav.toggleAttribute('data-open', open);
    const close = (e: Event) => { if ((e.target as Element).closest('.nav-links a')) setOpen(false); };
    nav.addEventListener('click', close);
    return () => nav.removeEventListener('click', close);
  }, [open]);
  return (
    <button ref={ref} type="button" class="nav-menu-btn" aria-expanded={open} aria-controls="site-nav-links"
            aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
      <Ico name={open ? 'close' : 'menu'} />
    </button>
  );
}
