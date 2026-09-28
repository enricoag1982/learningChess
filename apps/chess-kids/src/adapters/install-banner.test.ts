import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissInstallBanner,
  isInstallBannerDismissed,
  shouldShowInstallBanner,
} from './install-banner.ts';
import type { InstallBannerEnv } from './install-banner.ts';

// Real iPadOS 17 Safari (masquerades as a desktop Mac, but with multi-touch).
const IPAD_SAFARI: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  maxTouchPoints: 5,
  standalone: false,
};

// Older iPhone-style UA (still names the device directly).
const IPHONE_SAFARI: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
  standalone: false,
};

const DESKTOP_MAC_SAFARI: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  maxTouchPoints: 0,
  standalone: false,
};

const IPAD_CHROME: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
  standalone: false,
};

const IPAD_FIREFOX: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/120.0 Mobile/15E148 Safari/605.1.15',
  maxTouchPoints: 5,
  standalone: false,
};

const ANDROID_CHROME: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxTouchPoints: 5,
  standalone: false,
};

const DESKTOP_CHROME: InstallBannerEnv = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxTouchPoints: 0,
  standalone: false,
};

describe('shouldShowInstallBanner', () => {
  it('shows for iPad Safari (masquerading as desktop Mac, not standalone)', () => {
    expect(shouldShowInstallBanner(IPAD_SAFARI)).toBe(true);
  });

  it('shows for iPhone Safari, not standalone', () => {
    expect(shouldShowInstallBanner(IPHONE_SAFARI)).toBe(true);
  });

  it('never shows once already standalone (added to Home Screen, or Capacitor)', () => {
    expect(shouldShowInstallBanner({ ...IPAD_SAFARI, standalone: true })).toBe(false);
    expect(shouldShowInstallBanner({ ...IPHONE_SAFARI, standalone: true })).toBe(false);
  });

  it('never shows on a real desktop Mac (no multi-touch, same UA shape as iPad)', () => {
    expect(shouldShowInstallBanner(DESKTOP_MAC_SAFARI)).toBe(false);
  });

  it('never shows on Chrome or Firefox for iOS (different "Add to Home Screen" flow)', () => {
    expect(shouldShowInstallBanner(IPAD_CHROME)).toBe(false);
    expect(shouldShowInstallBanner(IPAD_FIREFOX)).toBe(false);
  });

  it('never shows on Android or desktop Chrome', () => {
    expect(shouldShowInstallBanner(ANDROID_CHROME)).toBe(false);
    expect(shouldShowInstallBanner(DESKTOP_CHROME)).toBe(false);
  });
});

describe('dismiss', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('is not dismissed until dismissInstallBanner is called, then stays dismissed', () => {
    expect(isInstallBannerDismissed()).toBe(false);
    dismissInstallBanner();
    expect(isInstallBannerDismissed()).toBe(true);
  });
});
