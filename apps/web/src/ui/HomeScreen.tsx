import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { lessonStatus, totalStars } from '@chess-kids/core';
import { pickCurrentLesson } from '../app/current-lesson.ts';
import { useAppStore, useServices } from '../app/store.ts';
import { avatarName, characterName } from '../content-text.ts';
import { avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { StarsPill } from './StarsPill.tsx';
import { useNarratedText } from './useNarratedText.ts';

function PlayIcon(): JSX.Element {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4l13 8-13 8z" fill="currentColor" />
    </svg>
  );
}

function SwitchPlayerIcon(): JSX.Element {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14a6 6 0 0 1 3.5 6" />
    </svg>
  );
}

/** Home: greeting, total stars, and the one primary action into today's lesson. */
export function HomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const startLesson = useAppStore((state) => state.startLesson);
  const goToPicker = useAppStore((state) => state.goToPicker);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    // jsdom (unit tests) and some browsers have no `serviceWorker`; skip the status line there.
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.ready.then(() => {
      if (!cancelled) setOfflineReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lesson = useMemo(() => pickCurrentLesson(services.deps.content.lessons()), [services]);
  const lessonProgress = progress.find((entry) => entry.lessonId === lesson?.id);
  const status = lesson ? lessonStatus(lesson, lessonProgress) : 'new';
  const stars = totalStars(progress);

  const name = lesson ? characterName(t, lesson.character) : '';
  const bubbleText = !lesson
    ? ''
    : status === 'new'
      ? t('home.owl-new', { name })
      : status === 'in-progress'
        ? t('home.owl-in-progress')
        : t('home.owl-done', { name });
  const replay = useNarratedText(services.narrator, bubbleText);

  if (!profile || !lesson) {
    // First render before `init()` resolves; a blank cream screen for an instant beats a flash.
    return <main className="min-h-screen bg-cream" />;
  }

  const buttonLabel =
    status === 'new' ? t('home.start') : status === 'in-progress' ? t('continue') : t('play-again');

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-cream px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-display text-lg text-muted sm:text-xl">{t('app.title')}</h1>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            role="img"
            aria-label={t('home.avatar-alt', { name: avatarName(t, profile.avatar) })}
            className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full p-2 sm:h-16 sm:w-16"
            style={{ backgroundColor: avatarBackground(profile.avatar) }}
          >
            <AvatarIcon avatar={profile.avatar} />
          </div>
          <span className="font-display text-2xl text-ink sm:text-3xl">{profile.nickname}</span>
        </div>
        <div className="flex items-center gap-3">
          <StarsPill count={stars} />
          <button
            type="button"
            aria-label={t('home.switch-player')}
            onClick={() => {
              void goToPicker();
            }}
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-line bg-card text-ink"
          >
            <SwitchPlayerIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-stretch justify-center gap-8 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-3">
          <SpeechBubble text={bubbleText} />
          <ReplayButton onClick={replay} label={t('exercise.replay')} />
        </div>
        <button
          type="button"
          onClick={() => {
            void startLesson(lesson.id);
          }}
          className="flex h-24 items-center justify-center gap-3 rounded-[2rem] bg-today px-8 font-display text-2xl font-semibold text-white sm:h-32 sm:w-96 sm:text-3xl"
        >
          <PlayIcon />
          {buttonLabel}
        </button>
      </div>

      <p className="min-h-[1.75rem] text-center text-base text-go">
        {offlineReady && (
          <span className="inline-flex items-center gap-2">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('offline.ready')}
          </span>
        )}
      </p>
    </main>
  );
}
