import { useEffect, useState } from 'preact/hooks';

/** "Log in", or "My Lessons →" once /api/me says the visitor is signed in (the page itself is the same for everyone). */
export default function AuthButton() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSignedIn(Boolean(d && d.user)))
      .catch(() => {});
  }, []);
  return signedIn
    ? <a class="btn btn-sm primary" href="/lessons/index.html">My Lessons →</a>
    : <a class="btn btn-sm" href="/login">Log in</a>;
}
