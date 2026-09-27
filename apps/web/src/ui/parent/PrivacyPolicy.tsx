import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { PARENT_INFO_PANEL, PARENT_PRIMARY_BUTTON } from './parent-styles.ts';

/** Repository issues page (non-functional.md §3 "contact"): the same repo the live app deploys
 * from (`CLAUDE.md`'s live URL, `docs/architecture.md` §10 "Web hosting"). */
const ISSUES_URL = 'https://github.com/enricoag1982/learningChess/issues';

/**
 * Privacy policy body (M5.5, non-functional.md §3, `docs/privacy-policy.md` — same text, kept in
 * sync by hand since one lives in i18n and the other in plain Markdown for the repo root): plain
 * English, fits one tablet screen. Shared by `PrivacyScreen` (parent area, `PrivacyScreen.tsx`) and
 * `PrivacyDialog` (first-run overlay, right below) so the wording only ever lives in one place —
 * exported (not just this file's own use) so `PrivacyScreen.tsx` can stay a separate, lazy-only
 * module: this one is reached before the parent gate too (`FirstRunScreen.tsx`), so it must stay in
 * the eager bundle, while `PrivacyScreen`'s own `ScreenHeader`/`ChevronLeftIcon` need not (lead
 * review 2026-09-27: `ChevronLeftIcon` in particular, since `icons-lazy.tsx`'s other export,
 * `GuestIcon`, was being pulled into the eager bundle right along with it).
 */
export function PrivacyPolicyBody(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('parent.privacy.intro')}</p>
      <section className={PARENT_INFO_PANEL}>
        <h3 className="text-sm font-extrabold text-ink">{t('parent.privacy.data-heading')}</h3>
        <p className="mt-1 text-sm text-muted">{t('parent.privacy.data-body')}</p>
      </section>
      <section className={PARENT_INFO_PANEL}>
        <h3 className="text-sm font-extrabold text-ink">
          {t('parent.privacy.no-accounts-heading')}
        </h3>
        <p className="mt-1 text-sm text-muted">{t('parent.privacy.no-accounts-body')}</p>
      </section>
      <section className={PARENT_INFO_PANEL}>
        <h3 className="text-sm font-extrabold text-ink">{t('parent.privacy.network-heading')}</h3>
        <p className="mt-1 text-sm text-muted">{t('parent.privacy.network-body')}</p>
      </section>
      <section className={PARENT_INFO_PANEL}>
        <h3 className="text-sm font-extrabold text-ink">{t('parent.privacy.control-heading')}</h3>
        <p className="mt-1 text-sm text-muted">{t('parent.privacy.control-body')}</p>
      </section>
      <section className={PARENT_INFO_PANEL}>
        <h3 className="text-sm font-extrabold text-ink">{t('parent.privacy.contact-heading')}</h3>
        {/* `wrap-anywhere`: the URL has no break points and overflows a phone-width panel. */}
        <p className="mt-1 text-sm text-muted wrap-anywhere">
          {t('parent.privacy.contact-body', { url: ISSUES_URL })}
        </p>
      </section>
    </div>
  );
}

export interface PrivacyDialogProps {
  readonly onClose: () => void;
}

/** First-run password step's "Read our privacy policy" link: an in-screen overlay, not a new
 * store screen (M5.5 lead note — the parent hasn't set the password yet, so the parent area
 * itself is not reachable here). */
export function PrivacyDialog({ onClose }: PrivacyDialogProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('parent.privacy.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col gap-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-extrabold text-ink">{t('parent.privacy.title')}</h2>
        {/* `tabIndex={0}` (axe `scrollable-region-focusable`): keyboard users must be able to
         * focus this region to scroll it, the same as any other scrollable panel would need. */}
        <div className="overflow-y-auto" tabIndex={0}>
          <PrivacyPolicyBody />
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`${PARENT_PRIMARY_BUTTON} flex-shrink-0 self-stretch`}
        >
          {t('parent.privacy.close')}
        </button>
      </div>
    </div>
  );
}

export interface PrivacyLinkProps {
  readonly onClick: () => void;
}

/** The link itself (first-run password step), kept here so its label stays next to the dialog it
 * opens. */
export function PrivacyLink({ onClick }: PrivacyLinkProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-sm font-bold text-info underline underline-offset-2"
    >
      {t('first-run.password.privacy-link')}
    </button>
  );
}
