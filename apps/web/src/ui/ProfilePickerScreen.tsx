import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../app/store.ts';
import { avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';

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

function PlusIcon(): JSX.Element {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Profile picker (kid style): app start whenever a parent lock exists (app-structure.md §3). */
export function ProfilePickerScreen(): JSX.Element {
  const { t } = useTranslation();
  const profiles = useAppStore((state) => state.profiles);
  const selectProfileAndHome = useAppStore((state) => state.selectProfileAndHome);
  const startNewPlayer = useAppStore((state) => state.startNewPlayer);
  const goToPasswordScreen = useAppStore((state) => state.goToPasswordScreen);

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 bg-cream px-4 py-8 sm:px-10 sm:py-12">
      <h1 className="text-center font-display text-3xl text-ink sm:text-4xl">
        {t('picker.title')}
      </h1>
      <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => {
              void selectProfileAndHome(profile.id);
            }}
            className="flex w-40 flex-col items-center gap-3 rounded-3xl border-2 border-line bg-card p-5 sm:w-52"
          >
            <span
              className="h-24 w-24 overflow-hidden rounded-full p-3 sm:h-32 sm:w-32"
              style={{ backgroundColor: avatarBackground(profile.avatar) }}
            >
              <AvatarIcon avatar={profile.avatar} />
            </span>
            <span className="font-display text-xl font-semibold text-ink sm:text-2xl">
              {profile.nickname}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            startNewPlayer(false);
          }}
          className="flex w-40 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[#CDBF9F] p-5 text-muted sm:w-52"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F1E9D8] sm:h-32 sm:w-32">
            <PlusIcon />
          </span>
          <span className="font-display text-lg font-semibold sm:text-xl">
            {t('picker.new-player')}
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          goToPasswordScreen();
        }}
        className="flex h-16 items-center gap-3 rounded-2xl border-2 border-line bg-card px-5 text-ink"
      >
        <LockIcon />
        <span className="flex flex-col items-start">
          <span className="text-sm font-extrabold">{t('picker.grown-ups')}</span>
          <span className="text-xs text-muted">{t('picker.grown-ups-hint')}</span>
        </span>
      </button>
    </main>
  );
}
