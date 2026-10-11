import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $user, loadUser } from '../stores/user';

/** "Log in", or "My Lessons →" once /api/me says the visitor is signed in (the page itself is the same for everyone). */
export default function AuthButton() {
  const user = useStore($user);
  useEffect(loadUser, []);
  return user
    ? <a class="btn btn-sm primary" href="/lessons/index.html">My Lessons →</a>
    : <a class="btn btn-sm" href="/login">Log in</a>;
}
