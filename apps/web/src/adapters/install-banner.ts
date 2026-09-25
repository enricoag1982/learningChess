/** localStorage key (`chess-kids:<name>`, `architecture.md` §11): remembers the iPad install
 * banner was dismissed, so it never comes back once a grown-up has seen it once
 * (`non-functional.md` §1/§4 "iPad install prompt", M5.4 decision table). A plain top-level key,
 * not part of the versioned app-data schema — a device-only UI preference, same pattern
 * `ui/lesson/VersusStep.tsx`'s own `chess-kids:test-seed` already uses. */
const DISMISSED_KEY = 'chess-kids:install-banner-dismissed';

/** The bits `shouldShowInstallBanner` needs, read once from the real `navigator`/`window` by
 * `readInstallBannerEnv` — kept as plain data so the UA/standalone matrix is unit-testable without
 * a DOM. */
export interface InstallBannerEnv {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Already running as an installed app — a standalone PWA (added to Home Screen already) or a
   * Capacitor shell (M8): never shown either way (`non-functional.md` §1 "Capacitor apps: all
   * assets bundled, offline by default" — no install prompt applies there at all). */
  readonly standalone: boolean;
}

/** iPadOS 13+ Safari reports as a desktop Mac in its own `userAgent` (unlike a real Mac, it also
 * supports multi-touch — `maxTouchPoints > 1` is the standard way to tell them apart). Excludes
 * other iOS browsers: still WebKit under the hood, but "Add to Home Screen" lives in a different
 * menu there, not the share icon this banner's own steps describe — showing Safari's steps on
 * Chrome/Firefox/Edge for iOS would just be wrong. */
function isIOSSafari(env: InstallBannerEnv): boolean {
  const ua = env.userAgent;
  const isAppleTouchDevice =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && env.maxTouchPoints > 1);
  if (!isAppleTouchDevice) {
    return false;
  }
  return !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

/** True only for iOS Safari, not already installed — the one browser/platform combination the
 * banner's own "tap the share icon" steps are actually correct for. */
export function shouldShowInstallBanner(env: InstallBannerEnv): boolean {
  return !env.standalone && isIOSSafari(env);
}

/** Reads the real environment; never throws (older Safari, private browsing). `navigator.standalone`
 * is iOS Safari's own non-standard flag; `display-mode: standalone` covers every other standalone
 * launch (desktop PWA installs, and a defensive fallback if iOS ever drops the non-standard flag). */
function isStandalone(): boolean {
  try {
    const iosNavigator = navigator as Navigator & { readonly standalone?: boolean };
    return (
      iosNavigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
    );
  } catch {
    return false;
  }
}

export function readInstallBannerEnv(): InstallBannerEnv {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
  };
}

/** Never throws (private browsing, disabled storage — same defensive pattern as `VersusStep.tsx`'s
 * `readTestSeed`): a storage failure just means the banner may show again, never a crash. */
export function isInstallBannerDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallBanner(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Best-effort only: worst case, the banner shows again next visit.
  }
}
