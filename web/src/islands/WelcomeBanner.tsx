import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $user, loadUser } from '../stores/user';

/** "Welcome back" bar on the Home page, shown only to a signed-in student. */
export default function WelcomeBanner() {
  const user = useStore($user);
  useEffect(loadUser, []);
  if (!user) return null;
  const name = user.display_name || user.username || 'Student';
  return (
    <div class="welcome-banner" role="status">
      <div><strong>Welcome back, <span>{name}</span>!</strong> You are currently logged in.</div>
      <a href="/lessons/index.html" class="btn btn-sm primary">Continue My Lessons →</a>
    </div>
  );
}
