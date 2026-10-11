// Who is signed in, for the public pages: one /api/me request per page, shared by every island that needs it.
import { atom } from 'nanostores';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

/** undefined: not asked yet; null: not signed in. */
export const $user = atom<User | null | undefined>(undefined);

let asked = false;
export function loadUser(): void {
  if (asked) return;
  asked = true;
  fetch('/api/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => $user.set(d && d.user ? (d.user as User) : null))
    .catch(() => $user.set(null));
}
