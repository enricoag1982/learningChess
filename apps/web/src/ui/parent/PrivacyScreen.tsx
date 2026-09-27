import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from '../ds/icons-lazy.tsx';
import { ScreenHeader } from '../ds/Screen.tsx';
import { PrivacyPolicyBody } from './PrivacyPolicy.tsx';

export interface PrivacyScreenProps {
  readonly onBack: () => void;
}

/** Parent area "Privacy" row's own screen (`ParentAreaScreen.tsx`'s local view router) — its own
 * file, not `PrivacyPolicy.tsx` (lead review 2026-09-27): that module is also reached eagerly, via
 * `FirstRunScreen.tsx`'s `PrivacyDialog`, so this component's own `ChevronLeftIcon` stays lazy-only
 * only by living somewhere that eager path never imports. */
export function PrivacyScreen({ onBack }: PrivacyScreenProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        look="parent"
        action="back"
        actionLabel={t('parent.back')}
        onAction={onBack}
        icon={<ChevronLeftIcon />}
        title={t('parent.privacy.title')}
      />
      <PrivacyPolicyBody />
    </div>
  );
}
