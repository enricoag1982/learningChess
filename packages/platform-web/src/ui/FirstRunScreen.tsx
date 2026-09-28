import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidPassword, setupParentPassword } from '@learn/platform-core';
import { useAppStore, useServices } from '../app/store.ts';
import { PrivacyDialog, PrivacyLink } from './parent/PrivacyPolicy.tsx';
import { PARENT_INPUT, PARENT_NOTE, PARENT_PRIMARY_BUTTON } from './parent/parent-styles.ts';
import { Owl } from './ds/Owl.tsx';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { LockIcon } from './ds/icons.tsx';
import { tapClass } from './ds/tap.ts';
import { Screen } from './ds/Screen.tsx';

type Step = 'welcome' | 'password' | 'saved';

/** Step 1 (kid style): Owl explains a grown-up helps set things up first. */
function Welcome({ onNext }: { readonly onNext: () => void }): JSX.Element {
  const { t } = useTranslation();
  const text = t('first-run.welcome.owl');

  return (
    <Screen kind="center" className="gap-8 px-4 py-8 sm:px-10">
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{t('app.title')}</h1>
      <Owl className="h-24 w-24" />
      <NarratedBubble
        text={text}
        layout="stack"
        bubbleClassName="text-xl sm:text-2xl text-center"
        replayClassName="self-center"
      />
      <button type="button" onClick={onNext} className={tapClass('hero', 'go')}>
        {t('first-run.welcome.primary')}
      </button>
    </Screen>
  );
}

/** Step 2 (parent style): sets the parent password and downloads the reminder file. */
function PasswordStep({ onSaved }: { readonly onSaved: (location: string) => void }): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isValidPassword(password)) {
      setError(t('first-run.password.too-short'));
      return;
    }
    if (password !== repeat) {
      setError(t('first-run.password.mismatch'));
      return;
    }
    setError(null);
    const { location } = await setupParentPassword(services.deps, password);
    onSaved(location);
  }

  return (
    <Screen kind="form" className="px-4 py-8 sm:px-10">
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-card p-6"
      >
        <div className="flex items-center gap-2 text-ink">
          <LockIcon />
          <h1 className="text-lg font-extrabold">{t('first-run.password.title')}</h1>
        </div>
        <p className="text-sm text-muted">{t('first-run.password.body')}</p>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          {t('first-run.password.label')}
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className={PARENT_INPUT}
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          {t('first-run.password.repeat-label')}
          <input
            type={show ? 'text' : 'password'}
            value={repeat}
            onChange={(event) => {
              setRepeat(event.target.value);
            }}
            className={PARENT_INPUT}
            autoComplete="new-password"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setShow((value) => !value);
          }}
          className="self-start text-sm font-bold text-info underline underline-offset-2"
        >
          {show ? t('first-run.password.hide') : t('first-run.password.show')}
        </button>

        <p className="text-xs text-muted">{t('first-run.password.rules')}</p>
        {error && <p className={PARENT_NOTE}>{error}</p>}

        <PrivacyLink
          onClick={() => {
            setShowPrivacy(true);
          }}
        />

        <button type="submit" className={PARENT_PRIMARY_BUTTON}>
          {t('first-run.password.primary')}
        </button>
      </form>
      {showPrivacy && (
        <PrivacyDialog
          onClose={() => {
            setShowPrivacy(false);
          }}
        />
      )}
    </Screen>
  );
}

/** Step 3 (parent style): confirms where the code file was saved. A new copy can be downloaded
 * later from the grown-ups area ("Download parent code file"). */
function SavedStep({
  location,
  onNext,
}: {
  readonly location: string;
  readonly onNext: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Screen kind="form" className="px-4 py-8 sm:px-10">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-card p-6">
        <h1 className="text-lg font-extrabold text-ink">{t('first-run.saved.title')}</h1>
        <p className="text-sm text-muted">{t('first-run.saved.body', { location })}</p>
        <button type="button" onClick={onNext} className={PARENT_PRIMARY_BUTTON}>
          {t('first-run.saved.primary')}
        </button>
      </div>
    </Screen>
  );
}

/** First run: Welcome (kid) → parent password → Saved, then `finishFirstRun` decides whether to
 * open the new-player wizard, go straight to Home, or show the picker. */
export function FirstRunScreen(): JSX.Element {
  const finishFirstRun = useAppStore((state) => state.finishFirstRun);
  const [step, setStep] = useState<Step>('welcome');
  const [location, setLocation] = useState('');

  if (step === 'welcome') {
    return (
      <Welcome
        onNext={() => {
          setStep('password');
        }}
      />
    );
  }
  if (step === 'password') {
    return (
      <PasswordStep
        onSaved={(loc) => {
          setLocation(loc);
          setStep('saved');
        }}
      />
    );
  }
  return (
    <SavedStep
      location={location}
      onNext={() => {
        void finishFirstRun();
      }}
    />
  );
}
