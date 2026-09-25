import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dismissInstallBanner,
  isInstallBannerDismissed,
  readInstallBannerEnv,
  shouldShowInstallBanner,
} from '../adapters/install-banner.ts';
import { Owl } from './Owl.tsx';

/** Real `navigator`/`window`/`localStorage`, read once — `useState`'s lazy initialiser runs
 * exactly at mount, same "once on mount" timing an effect would give, without the extra
 * render-then-setState pass an effect doing the same thing would cost. */
function initiallyVisible(): boolean {
  return !isInstallBannerDismissed() && shouldShowInstallBanner(readInstallBannerEnv());
}

/**
 * One-time Home banner for iOS Safari, not already installed (`non-functional.md` §1/§4 "iPad
 * install prompt", M5.4 decision table): Safari may clear website data after 7 days without use, so
 * this nudges a grown-up to add the app to the Home Screen, which keeps it around. `install-banner.ts`
 * has the actual UA/standalone logic and the dismiss flag. Flat, tinted "info" panel (`docs/screens.md`
 * §1 colour roles — blue = info; the roadmap's own F3 "tappable vs info" rule, not yet formalised
 * elsewhere, already points the same way for a non-navigating notice like this one), not a card:
 * nothing here navigates anywhere, so it should not look like it does.
 */
export function InstallBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(initiallyVisible);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl p-4"
      style={{ backgroundColor: '#EAF1FB' }}
    >
      <Owl className="h-12 w-12" />
      <div className="flex-1">
        <p className="font-display text-base font-semibold text-ink">{t('install-banner.title')}</p>
        <p className="text-sm text-muted">{t('install-banner.steps')}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          dismissInstallBanner();
          setVisible(false);
        }}
        className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full px-3 text-sm font-bold text-info"
      >
        {t('install-banner.dismiss')}
      </button>
    </div>
  );
}
