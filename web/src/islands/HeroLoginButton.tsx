import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $user, loadUser } from '../stores/user';
import Ico from './Ico';

/** The Home hero's third button: "Student Log in", or "Open Dashboard" for a signed-in student. */
export default function HeroLoginButton() {
  const user = useStore($user);
  useEffect(loadUser, []);
  return user
    ? <a href="/lessons/index.html" class="btn">Open Dashboard</a>
    : <a href="/login" class="btn"><Ico name="key" /> Student Log in</a>;
}
