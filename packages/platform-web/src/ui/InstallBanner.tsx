import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dismissInstallBanner,
  isInstallBannerDismissed,
  readInstallBannerEnv,
  shouldShowInstallBanner,
} from '../adapters/install-banner.ts';
import { useServices } from '../app/store.ts';
import { Owl } from './ds/Owl.tsx';

function initiallyVisible(storagePrefix: string): boolean {
  return (
    !isInstallBannerDismissed(storagePrefix) && shouldShowInstallBanner(readInstallBannerEnv())
  );
}

/** One-time Home banner for iOS Safari, not already installed (`non-functional.md` §1/§4): Safari
 * may clear website data after 7 days unused, so this nudges adding to the Home Screen. */
export function InstallBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const { storagePrefix } = useServices().deps.app;
  const [visible, setVisible] = useState(() => initiallyVisible(storagePrefix));

  if (!visible) {
    return null;
  }

  return (
    <div
      role="note"
      className="info-flat flex items-start gap-3 rounded-2xl p-4"
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
          dismissInstallBanner(storagePrefix);
          setVisible(false);
        }}
        className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full px-3 text-sm font-bold text-info underline underline-offset-2"
      >
        {t('install-banner.dismiss')}
      </button>
    </div>
  );
}
