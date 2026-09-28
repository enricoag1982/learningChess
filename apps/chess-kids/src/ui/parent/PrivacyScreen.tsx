import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from '../ds/icons-lazy.tsx';
import { ScreenHeader } from '../ds/Screen.tsx';
import { PrivacyPolicyBody } from './PrivacyPolicy.tsx';

export interface PrivacyScreenProps {
  readonly onBack: () => void;
}

/** Parent area "Privacy" row's own screen — its own file, not `PrivacyPolicy.tsx`, since that
 * module is also reached eagerly and must never import the lazy-only `ChevronLeftIcon`. */
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
