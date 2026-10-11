import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $lang, LANGS, loadPrefs, setLang, type Lang } from '../stores/prefs';
import { ACCOUNT_WORDS } from '../lib/account-i18n';
import { clearPageCache, forgetLocalStudentData } from '../lib/page-cache';

const LABEL: Record<Lang, string> = { en: 'English', ta: 'தமிழ்', si: 'සිංහල' };
type Msg = { ok: boolean; text: string } | null;
interface Me { username: string; display_name: string; role: string }

async function post(url: string, body: object = {}) {
  const r = await fetch(url, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'stemcloud' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || 'Something went wrong.');
  return j;
}

const Note = ({ m }: { m: Msg }) => <div class={`msg ${m ? (m.ok ? 'ok' : 'err') : ''}`} role="status" aria-live="polite">{m?.text}</div>;

/** "My account": name, XP and badges, language, display name, password, delete account, log out (same API as before). */
export default function AccountPanel() {
  const lang = useStore($lang);
  const T = (en: string) => (lang === 'en' || !ACCOUNT_WORDS[en] ? en : ACCOUNT_WORDS[en]![lang === 'ta' ? 0 : 1]);
  const [me, setMe] = useState<Me | null>(null);
  const [xp, setXp] = useState(0);
  const [badges, setBadges] = useState(0);
  const [m1, setM1] = useState<Msg>(null);
  const [m2, setM2] = useState<Msg>(null);
  const [m3, setM3] = useState<Msg>(null);

  useEffect(() => {
    loadPrefs();
    fetch('/api/me', { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) { location.href = '/login?next=/account'; return null; }
      return r.json();
    }).then((j) => { if (j?.user) setMe(j.user); }).catch(() => {});
    fetch('/api/progress', { credentials: 'same-origin' }).then((r) => r.json()).then((j) => {
      const p = j.progress || {};
      setXp(parseInt(p.scx_xp_total || '0', 10) || 0);
      try { setBadges(JSON.parse(p.scx_badges || '[]').length); } catch { /* keep 0 */ }
    }).catch(() => {});
  }, []);
  useEffect(() => { document.title = 'STEM Cloud · ' + T('· My account').replace(/^· /, ''); }, [lang]);

  const admin = me?.role === 'admin';
  // Each card is a form read when it is submitted (Enter works; a password manager filling and submitting at once works too).
  const fields = (e: Event) => { e.preventDefault(); const f = e.currentTarget as HTMLFormElement; return { form: f, v: (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value }; };
  const saveName = (e: Event) => { const { v } = fields(e); post('/api/account/name', { display_name: v('display_name') }).then(() => { setMe((m) => (m ? { ...m, display_name: v('display_name').trim().slice(0, 30) } : m)); setM1({ ok: true, text: T('Saved ✓') }); }).catch((err) => setM1({ ok: false, text: err.message })); };
  const savePw = (e: Event) => {
    const { form, v } = fields(e);
    post('/api/account/password', { old: v('old'), new: v('new') })
      .then(() => { form.reset(); setM2({ ok: true, text: T('Password changed ✓') }); })
      .catch((err) => setM2({ ok: false, text: err.message }));
  };
  const del = (e: Event) => {
    const { v } = fields(e);
    post('/api/account/delete', { password: v('password') })
      .then(() => { forgetLocalStudentData(); clearPageCache(); location.href = '/login'; })
      .catch((err) => setM3({ ok: false, text: err.message }));
  };
  const logout = () => { clearPageCache(); post('/api/logout').then(() => { location.href = '/login'; }).catch(() => {}); };

  return (
    <>
      <header class="acct-head">
        <p class="brand"><img src="/static/brand/logo-mark.png" alt="" width="48" height="31" />STEM <b>Cloud</b> <span>{T('· My account')}</span></p>
        <p class="back"><a href={admin ? '/admin' : '/lessons/index.html'}>{admin ? '← Admin panel' : T('← Back to lessons')}</a></p>
      </header>

      <section class="card">
        <h1 class="who">{me ? `${me.display_name} (@${me.username})` : '…'}</h1>
        <div class="stats">
          <div class="stat"><span>XP</span><b>{xp}</b></div>
          <div class="stat"><span>{T('Badges')}</span><b>{badges}</b></div>
        </div>
      </section>

      <section class="card" aria-labelledby="lang-h">
        <h2 id="lang-h">{T('Language')}</h2>
        <div class="langrow" role="group" aria-labelledby="lang-h">
          {LANGS.map((l) => <button class="btn" type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{LABEL[l]}</button>)}
        </div>
      </section>

      <form class="card" aria-labelledby="name-h" onSubmit={saveName}>
        <h2 id="name-h">{T('Change my name')}</h2>
        <input type="text" name="display_name" maxLength={30} aria-label={T('Display name')} defaultValue={me?.display_name ?? ''} key={me?.display_name ?? ''} />
        <button class="btn primary full" type="submit">{T('Save name')}</button>
        <Note m={m1} />
      </form>

      <form class="card" aria-labelledby="pw-h" onSubmit={savePw}>
        <h2 id="pw-h">{T('Change my password')}</h2>
        <label for="op">{T('Current password')}</label>
        <input type="password" id="op" name="old" autocomplete="current-password" />
        <label for="np">{T('New password')}</label>
        <input type="password" id="np" name="new" autocomplete="new-password" />
        <p class="hint">{T('At least 8 characters. Other devices will be logged out.')}</p>
        <button class="btn primary full" type="submit">{T('Change password')}</button>
        <Note m={m2} />
      </form>

      <form class="card" aria-labelledby="del-h" onSubmit={del}>
        <h2 id="del-h">{T('Delete my account')}</h2>
        <p class="hint">{T('This removes your account and all your saved progress for good. It cannot be undone.')}</p>
        <label for="dp">{T('Type your password to confirm')}</label>
        <input type="password" id="dp" name="password" autocomplete="current-password" />
        <button class="btn bad full" type="submit">{T('Delete my account')}</button>
        <Note m={m3} />
      </form>

      <div class="row">
        <button class="btn" type="button" onClick={logout}>{T('Log out')}</button>
        {admin && <a class="btn" href="/admin">Admin</a>}
      </div>
      <p class="foot"><a href="/privacy">{T('Privacy')}</a> · <a href="/terms">Terms</a></p>
    </>
  );
}
