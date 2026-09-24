import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { lessonStatus, totalStars } from '@chess-kids/core';
import { pickCurrentLesson } from '../app/current-lesson.ts';
import { useAppStore, useServices } from '../app/store.ts';
import { characterName } from '../content-text.ts';
import { FoxIcon } from './art/characters.tsx';
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

/** Home: greeting, total stars, and the one primary action into today's lesson. */
export function HomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const startLesson = useAppStore((state) => state.startLesson);
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
            aria-label={t('home.avatar-alt')}
            className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-[#F9D9C2] p-2 sm:h-16 sm:w-16"
          >
            <FoxIcon />
          </div>
          <span className="font-display text-2xl text-ink sm:text-3xl">{profile.nickname}</span>
        </div>
        <StarsPill count={stars} />
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
