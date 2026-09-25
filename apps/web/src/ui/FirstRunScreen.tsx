import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidPassword, setupParentPassword } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { PrivacyDialog, PrivacyLink } from './parent/PrivacyPolicy.tsx';
import { PARENT_INPUT, PARENT_NOTE, PARENT_PRIMARY_BUTTON } from './parent/parent-styles.ts';
import { Owl } from './Owl.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { useNarratedText } from './useNarratedText.ts';

type Step = 'welcome' | 'password' | 'saved';

function LockIcon(): JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Step 1 (kid style): Owl explains a grown-up helps set things up first. */
function Welcome({ onNext }: { readonly onNext: () => void }): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const text = t('first-run.welcome.owl');
  const replay = useNarratedText(services.narrator, text);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-cream px-4 py-8 text-center sm:px-10">
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{t('app.title')}</h1>
      <Owl className="h-24 w-24" />
      <div className="flex w-full max-w-md flex-col items-stretch gap-3">
        <SpeechBubble text={text} bubbleClassName="text-xl sm:text-2xl text-center" />
        <ReplayButton onClick={replay} label={t('exercise.replay')} className="self-center" />
      </div>
      <button
        type="button"
        onClick={onNext}
        className="tap-raised tap-go flex h-16 w-full max-w-sm items-center justify-center rounded-[2rem] bg-go px-8 font-display text-xl font-semibold text-white sm:h-20 sm:text-2xl"
      >
        {t('first-run.welcome.primary')}
      </button>
    </main>
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-8 sm:px-10">
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
    </main>
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-8 sm:px-10">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-card p-6">
        <h1 className="text-lg font-extrabold text-ink">{t('first-run.saved.title')}</h1>
        <p className="text-sm text-muted">{t('first-run.saved.body', { location })}</p>
        <button type="button" onClick={onNext} className={PARENT_PRIMARY_BUTTON}>
          {t('first-run.saved.primary')}
        </button>
      </div>
    </main>
  );
}

/** First run: Welcome (kid) → parent password (parent) → Saved (parent), then the store decides
 * whether to open the new-player wizard, go straight to Home, or show the picker
 * (`finishFirstRun`, see store.ts and the M2.1 spec's "Existing installs" note). */
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
