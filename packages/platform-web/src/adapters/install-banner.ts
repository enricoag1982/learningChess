/** Remembers the iPad install banner was dismissed, so it never comes back. A plain top-level
 * key, not part of the versioned app-data schema — a device-only UI preference. */
const DISMISSED_KEY = 'chess-kids:install-banner-dismissed';

/** Plain data so the UA / standalone matrix is unit-testable without a DOM. */
export interface InstallBannerEnv {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Already running as an installed app (standalone PWA or a Capacitor shell): never shown. */
  readonly standalone: boolean;
}

/** iPadOS 13+ Safari reports as a desktop Mac (unlike a real Mac, `maxTouchPoints > 1`); excludes
 * other iOS browsers, whose "Add to Home Screen" lives in a different menu. */
function isIOSSafari(env: InstallBannerEnv): boolean {
  const ua = env.userAgent;
  const isAppleTouchDevice =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && env.maxTouchPoints > 1);
  if (!isAppleTouchDevice) {
    return false;
  }
  return !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

/** iOS Safari only, not installed: the one combination the banner's "tap the share icon" steps fit. */
export function shouldShowInstallBanner(env: InstallBannerEnv): boolean {
  return !env.standalone && isIOSSafari(env);
}

/** Never throws (older Safari, private browsing). `navigator.standalone` is iOS Safari's own
 * flag; `display-mode: standalone` covers every other standalone launch. */
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

/** Never throws (private browsing, disabled storage): a failure only means the banner may show again. */
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
