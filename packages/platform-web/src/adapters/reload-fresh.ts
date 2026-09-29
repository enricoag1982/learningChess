/** Drops the offline copy (service workers + Cache Storage), then reloads so the newest app is fetched; never touches app data.
 * Lazy chunk (initial-JS ceiling). Each API may be missing (dev, jsdom, old Safari); a failure still ends in the reload. */
export async function reloadFresh(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best effort: a plain reload is still better than a stuck button.
  }
  window.location.reload();
}
