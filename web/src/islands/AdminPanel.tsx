import { useEffect, useState } from 'preact/hooks';
import Ico from './Ico';

interface User { id: number; username: string; display_name: string; role: string; created_at: number; last_seen: number; devices: number; badges: number }
interface Created { username: string; password: string; role: string }
type Msg = { ok: boolean; text: string } | null;

async function post(url: string, body: object) {
  const r = await fetch(url, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || 'Request failed');
  return j;
}

/** "Phys-" + 6 letters/digits + 2 digits, the format admins already hand out; drawn from crypto.getRandomValues
 *  (the old page used Math.random, which is not meant for secrets). */
export function randomPassword(): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const r = crypto.getRandomValues(new Uint32Array(8));
  let s = 'Phys-';
  for (let i = 0; i < 6; i++) s += abc[r[i]! % abc.length];
  return s + String(10 + (r[6]! % 90));
}

const day = (t: number) => (t ? new Date(t * 1000).toLocaleDateString() : '');
function ago(t: number): string {
  const s = Math.max(0, Date.now() / 1000 - t);
  return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago';
}
const loginText = (c: Created) => `Username: ${c.username}\nPassword: ${c.password}\n`;

/** Admin panel: totals, create an account (and share its login), and manage every account (same API as before). */
export default function AdminPanel() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [armed, setArmed] = useState<number | null>(null);

  const load = () => fetch('/api/admin/users', { credentials: 'same-origin' }).then((r) => {
    if (r.status === 401) location.href = '/login?next=/admin';
    if (!r.ok) throw new Error('Not allowed');
    return r.json();
  }).then((j) => setUsers(j.users)).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { setPw(randomPassword()); load(); }, []);

  const create = (e: Event) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value;
    const body = { display_name: v('display_name').trim(), username: v('username').trim().toLowerCase(), password: v('password'), role: v('role') };
    setBusy(true);
    post('/api/admin/create-user', body).then(() => {
      setCreated({ username: body.username, password: body.password, role: body.role });
      setMsg({ ok: true, text: 'Created user @' + body.username + ' successfully.' });
      f.reset();
      setPw(randomPassword());
      load();
    }).catch((err) => setMsg({ ok: false, text: err.message })).finally(() => setBusy(false));
  };
  const copy = () => {
    if (!created) return;
    navigator.clipboard.writeText('STEM Cloud Physics Login\n' + loginText(created) + 'Login here: ' + location.origin + '/login').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const shareWa = () => {
    if (!created) return;
    const text = encodeURIComponent('Welcome to STEM Cloud Physics!\n\nHere are your login details:\n' + loginText(created) + '\nLog in here: ' + location.origin + '/login');
    window.open('https://wa.me/?text=' + text, '_blank', 'noopener');
  };
  const reset = (u: User) => {
    const np = randomPassword();
    post('/api/admin/reset', { id: u.id, password: np })
      .then(() => setMsg({ ok: true, text: 'New password for @' + u.username + ': ' + np + '  (student can change it in My account)' }))
      .catch((e) => setMsg({ ok: false, text: e.message }));
  };
  const kick = (u: User) => post('/api/admin/kick-devices', { id: u.id })
    .then(() => { setMsg({ ok: true, text: 'Logged out all devices for @' + u.username }); load(); })
    .catch((e) => setMsg({ ok: false, text: e.message }));
  const del = (u: User) => {
    if (armed !== u.id) { setArmed(u.id); return; }
    post('/api/admin/delete', { id: u.id })
      .then(() => { setArmed(null); setMsg({ ok: true, text: 'Deleted @' + u.username }); load(); })
      .catch((e) => { setArmed(null); setMsg({ ok: false, text: e.message }); });
  };

  const week = Date.now() / 1000 - 7 * 86400;
  const list = users ?? [];
  return (
    <>
      <section class="card stats" aria-label="Totals">
        <div class="stat"><span>Students</span><b>{list.length}</b></div>
        <div class="stat"><span>Active in last 7 days</span><b>{list.filter((u) => u.last_seen > week).length}</b></div>
      </section>

      <section class="card" aria-labelledby="create-h">
        <h2 id="create-h">Create New Account</h2>
        <p class="sub">Admins create accounts for students and fellow teachers. Public registration is closed.</p>
        <form class="create-grid" autocomplete="off" onSubmit={create}>
          <div>
            <label for="newDn">Display Name</label>
            <input type="text" id="newDn" name="display_name" maxLength={30} placeholder="e.g. Kamal Perera" required />
          </div>
          <div>
            <label for="newUn">Username</label>
            <input type="text" id="newUn" name="username" maxLength={20} placeholder="e.g. kamal_p" autocapitalize="none" spellcheck={false} required aria-describedby="un-hint" />
            <p class="hint" id="un-hint">3-20 letters, numbers, or _ (no spaces)</p>
          </div>
          <div>
            <label for="newPw">Password</label>
            <div class="pw-gen">
              <input type="text" id="newPw" name="password" maxLength={200} placeholder="Password" required value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
              <button class="btn" type="button" onClick={() => setPw(randomPassword())} title="Generate strong random password">Generate</button>
            </div>
          </div>
          <div>
            <label for="newRole">Role</label>
            <select id="newRole" name="role">
              <option value="student" selected>Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="full-w"><button class="btn primary" type="submit" disabled={busy}>Create Account</button></div>
        </form>
        {created && (
          <div class="cred-card" role="status">
            <b><Ico name="check" /> Account Created Successfully!</b>
            <p>Share these login details with the student:</p>
            <div class="cred-row">Username: {created.username} | Password: {created.password} (Role: {created.role})</div>
            <div class="cred-actions">
              <button class="btn btn-sm" type="button" onClick={copy}>{copied ? 'Copied!' : 'Copy Login Details'}</button>
              <button class="btn btn-sm btn-whatsapp" type="button" onClick={shareWa}><Ico name="chat" /> Send via WhatsApp</button>
            </div>
          </div>
        )}
      </section>

      <section class="card" aria-labelledby="users-h">
        <h2 id="users-h">Registered Users</h2>
        <div class={`msg ${msg ? (msg.ok ? 'ok' : 'err') : ''}`} role="status" aria-live="polite">{msg?.text}</div>
        <div class="tw">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Devices</th><th>Badges</th><th>Joined</th><th>Last seen</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name}<div class="hint">@{u.username}</div></td>
                  <td><span class={`pill ${u.role}`}>{u.role}</span></td>
                  <td>{(u.devices || 0) + ' / 2 active'}</td>
                  <td>{u.badges}</td>
                  <td>{day(u.created_at)}</td>
                  <td>{ago(u.last_seen)}</td>
                  <td class="actions">
                    <button class="btn btn-sm" type="button" onClick={() => reset(u)}>Reset pw</button>
                    {u.devices > 0 && <button class="btn btn-sm" type="button" onClick={() => kick(u)}>Logout devices</button>}
                    <button class="btn btn-sm bad" type="button" onClick={() => del(u)}>{armed === u.id ? 'Click again to confirm' : 'Delete'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
