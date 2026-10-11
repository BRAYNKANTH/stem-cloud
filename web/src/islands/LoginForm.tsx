import { useEffect, useRef, useState } from 'preact/hooks';
import Ico from './Ico';
import { clearPageCache } from '../lib/page-cache';

interface Device { id: string; name?: string; created_at?: number }
interface Creds { username: string; password: string }
type Msg = { kind: '' | 'err' | 'ok'; text: string };

declare global {
  interface Window { StemApp?: { canInstall(): boolean; install(): Promise<boolean> } }
}

/** Where to go after logging in: a safe same-site ?next= path, else the admin panel or the lessons (as before). */
export function nextPath(search: string, role: string): string {
  const n = new URLSearchParams(search).get('next');
  return n && n.charAt(0) === '/' && n.charAt(1) !== '/' && n.indexOf('\\') < 0 ? n : role === 'admin' ? '/admin' : '/lessons/index.html';
}

function timeAgo(ts?: number): string {
  if (!ts) return 'recently';
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  const days = Math.floor(diff / 86400);
  return days === 1 ? 'yesterday' : days + ' days ago';
}

async function login(body: Creds & { kick_device?: string }) {
  const r = await fetch('/api/login', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

/** Log in form, the two-device limit dialog and the "Install the app" button. */
export default function LoginForm() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>({ kind: '', text: '' });
  const [devices, setDevices] = useState<Device[]>([]);
  const [pending, setPending] = useState<Creds | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    clearPageCache();
    const update = () => setCanInstall(Boolean(window.StemApp?.canInstall()));
    document.addEventListener('stem-install-change', update);
    window.addEventListener('load', update);
    update();
    return () => { document.removeEventListener('stem-install-change', update); window.removeEventListener('load', update); };
  }, []);

  const done = (role: string, switched: boolean) => {
    const admin = role === 'admin';
    setMsg({ kind: 'ok', text: (switched ? 'Device switched successfully! ' : 'Welcome back! ') + (admin ? 'Opening the admin panel…' : 'Opening your lessons…') });
    location.href = nextPath(location.search, admin ? 'admin' : '');
  };
  const offline = () => setMsg({ kind: 'err', text: 'Cannot reach the server. Check your internet connection.' });
  const closeDevices = () => { dialog.current?.close(); setPending(null); setSwitching(null); };

  const submit = async (e: Event) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    const creds = { username: (f.elements.namedItem('username') as HTMLInputElement).value, password: (f.elements.namedItem('password') as HTMLInputElement).value };
    setMsg({ kind: '', text: '' });
    setBusy(true);
    try {
      const x = await login(creds);
      if (x.status === 409 && x.j && x.j.device_limit) {
        setBusy(false);
        setPending(creds);
        setDevices(x.j.devices || []);
        dialog.current?.showModal();
        return;
      }
      if (!x.ok) { setMsg({ kind: 'err', text: x.j.detail || 'Wrong username or password.' }); setBusy(false); return; }
      done(x.j?.user?.role, false);
    } catch { offline(); setBusy(false); }
  };

  const kick = async (id: string) => {
    if (!pending) return;
    setSwitching(id);
    setMsg({ kind: '', text: '' });
    try {
      const x = await login({ ...pending, kick_device: id });
      closeDevices();
      if (!x.ok) { setMsg({ kind: 'err', text: x.j.detail || 'Could not complete login. Please try again.' }); setBusy(false); return; }
      done(x.j?.user?.role, true);
    } catch { closeDevices(); offline(); setBusy(false); }
  };

  return (
    <>
      <form onSubmit={submit} autocomplete="on">
        <label for="un">Username</label>
        <input type="text" id="un" name="username" maxLength={20} autocomplete="username" autocapitalize="none" spellcheck={false} placeholder="e.g. kamal_p" required />
        <label for="pw">Password</label>
        <div class="pw-wrap">
          <input type={show ? 'text' : 'password'} id="pw" name="password" maxLength={200} autocomplete="current-password" placeholder="Your password" required />
          <button type="button" class="eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}>
            <Ico name={show ? 'eyeoff' : 'eye'} />
          </button>
        </div>
        <button class="btn primary full" type="submit" disabled={busy}>Log in</button>
        <div class={`msg ${msg.kind}`} role="alert">{msg.text}</div>
      </form>

      {canInstall && (
        <p class="install-row"><button class="btn" type="button" onClick={() => window.StemApp?.install()}><Ico name="download" /> Install the app</button></p>
      )}

      <dialog ref={dialog} class="device-dialog" aria-labelledby="dev-title" onCancel={(e) => { e.preventDefault(); closeDevices(); }}>
        <div class="device-icon" aria-hidden="true"><Ico name="phone" /><Ico name="warn" /></div>
        <h2 id="dev-title">Device Limit Reached</h2>
        <p>Your account is already signed in on <strong>2 devices</strong> (maximum allowed). To sign in on this device, please select which device to log out:</p>
        <div class="device-list">
          {devices.length ? devices.map((d, i) => (
            <div class="device-row">
              <div class="device-info"><b>{d.name || 'Device ' + (i + 1)}</b><small>Signed in {timeAgo(d.created_at)}</small></div>
              <button class="btn btn-sm bad" type="button" disabled={switching !== null} onClick={() => kick(d.id)}>
                {switching === d.id ? 'Switching…' : 'Log out & Sign in'}
              </button>
            </div>
          )) : <p class="device-empty">Active session records found. Click below to reset:</p>}
        </div>
        <div class="device-actions">
          <button class="btn bad full" type="button" disabled={switching !== null} onClick={() => kick('all')}>
            {switching === 'all' ? 'Switching all…' : 'Log out all other devices & sign in'}
          </button>
          <button class="btn full" type="button" onClick={closeDevices}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}
