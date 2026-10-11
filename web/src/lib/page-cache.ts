// Offline copies of lesson pages hold one student's progress (public/static/sw.js keeps them in "stemcloud-pages-*"),
// so they are forgotten whenever a student logs out, deletes the account or the login page opens (shared computers).
export function clearPageCache(): void {
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'clear-pages' }); } catch { /* no service worker */ }
  try { caches.keys().then((ks) => ks.filter((k) => k.indexOf('stemcloud-pages-') === 0).forEach((k) => caches.delete(k))); } catch { /* no Cache API */ }
}

/** A student's saved settings and offline progress on this device (as the current account page removes them). */
export function forgetLocalStudentData(): void {
  try {
    Object.keys(localStorage).filter((k) => /^(scx_|stem_pp_|lessonLang$|lessonTheme$|acct_owner$)/.test(k)).forEach((k) => localStorage.removeItem(k));
  } catch { /* private mode */ }
}
