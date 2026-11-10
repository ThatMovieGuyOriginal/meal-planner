import { registerSW } from 'virtual:pwa-register';
import { getUi, saveNow, setUi } from '../state/store';

/** How long after opening (or returning to) the app a reload counts as unnoticeable. */
const JUST_OPENED_MS = 15_000;
const CHECK_EVERY_MS = 60 * 60 * 1000;

let shownAt = Date.now();

export function reloadForUpdate(): void {
  saveNow();
  window.location.reload();
}

/** A reload is safe when she isn't looking, or has only just opened the app and isn't mid-edit. */
function safeToReload(): boolean {
  if (document.visibilityState === 'hidden') return true;
  const editing = document.querySelector('.sheet') !== null;
  return !editing && Date.now() - shownAt < JUST_OPENED_MS;
}

/**
 * New versions install in the background. An iPhone home-screen app often resumes rather than
 * restarting, so without this she could stay on an old version for days. The page reloads into
 * the new version at a safe moment, or shows an "Update now" banner.
 */
export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onNeedReload() {
      if (safeToReload()) reloadForUpdate();
      else setUi({ updateReady: true });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => { if (navigator.onLine) registration.update().catch(() => undefined); };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') {
          if (getUi().updateReady) reloadForUpdate();
          return;
        }
        shownAt = Date.now();
        if (getUi().updateReady && safeToReload()) reloadForUpdate();
        else check();
      });
      setInterval(check, CHECK_EVERY_MS);
    },
  });
}
