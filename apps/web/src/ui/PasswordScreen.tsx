import { useEffect, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { verifyParentPassword } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { formatCountdown } from './parent/countdown.ts';
import {
  PARENT_INPUT,
  PARENT_NOTE,
  PARENT_PRIMARY_BUTTON,
  PARENT_SECONDARY_BUTTON,
} from './parent/parent-styles.ts';

const MAX_ATTEMPTS = 5;
/** How often the countdown re-reads the clock while locked. */
const TICK_MS = 500;

function LockIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
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

/** Grown-ups gate (parent style): non-functional.md §3 — 5 wrong attempts → 1-minute wait. */
export function PasswordScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const goToPicker = useAppStore((state) => state.goToPicker);
  const goToParentArea = useAppStore((state) => state.goToParentArea);
  const grantMoreTimeAndResume = useAppStore((state) => state.grantMoreTimeAndResume);
  const passwordPurpose = useAppStore((state) => state.passwordPurpose);

  const [input, setInput] = useState('');
  const [fileLocation, setFileLocation] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    void services.deps.parentLock.get().then((lock) => {
      setFileLocation(lock?.fileLocation ?? null);
    });
  }, [services]);

  // Ticks every 500ms while locked, clearing the lock once its time is up (from the interval
  // callback, not the effect body itself, so this is an external-system subscription, not a
  // synchronous setState-in-effect).
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => {
      const remaining = new Date(lockedUntil).getTime() - services.deps.clock.now().getTime();
      if (remaining <= 0) {
        setLockedUntil(null);
      } else {
        tick((value) => value + 1);
      }
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [lockedUntil, services]);

  const remainingMs = lockedUntil
    ? new Date(lockedUntil).getTime() - services.deps.clock.now().getTime()
    : 0;
  const isLocked = lockedUntil !== null && remainingMs > 0;

  async function onSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = await verifyParentPassword(services.deps, input);
    setInput('');
    if (result.ok) {
      setWrongAttempts(null);
      setLockedUntil(null);
      if (passwordPurpose === 'more-time') {
        await grantMoreTimeAndResume();
      } else {
        await goToParentArea();
      }
      return;
    }
    const lock = await services.deps.parentLock.get();
    if (result.waitMs > 0) {
      setLockedUntil(lock?.lockedUntil ?? null);
      setWrongAttempts(null);
    } else {
      setWrongAttempts(lock?.failedAttempts ?? null);
    }
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
          <h1 className="text-lg font-extrabold">{t('password-screen.title')}</h1>
        </div>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          {t('password-screen.label')}
          <input
            type="password"
            value={input}
            disabled={isLocked}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            className={PARENT_INPUT}
            autoFocus
          />
        </label>

        {wrongAttempts !== null && (
          <p className={PARENT_NOTE}>
            {t('password-screen.wrong', { attempt: wrongAttempts, max: MAX_ATTEMPTS })}
          </p>
        )}
        {isLocked && (
          <p className={PARENT_NOTE}>
            {t('password-screen.locked', { time: formatCountdown(remainingMs) })}
          </p>
        )}

        {fileLocation && (
          <p className="text-xs text-muted">
            {t('password-screen.forgot', { location: fileLocation })}
          </p>
        )}

        <button type="submit" disabled={isLocked} className={PARENT_PRIMARY_BUTTON}>
          {t('password-screen.primary')}
        </button>
        <button
          type="button"
          onClick={() => {
            void goToPicker();
          }}
          className={PARENT_SECONDARY_BUTTON}
        >
          {t('password-screen.back')}
        </button>
      </form>
    </main>
  );
}
