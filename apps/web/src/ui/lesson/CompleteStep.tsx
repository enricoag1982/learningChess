import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@chess-kids/core';
import { lessonStars } from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { StarsRow } from '../StarsRow.tsx';

export interface CompleteStepProps {
  readonly lesson: Lesson;
  /** Restart this lesson at the story. */
  readonly onPlayAgain: () => void;
  /** Back to Home. */
  readonly onContinue: () => void;
}

function NewGameIcon(): JSX.Element {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2E7D5B"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={3} y={3} width={18} height={18} rx={3} />
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}

/** Reward stars (1–3) from the percentage of the lesson's max stars actually earned. */
function ratingStars(earned: number, max: number): 1 | 2 | 3 {
  if (max <= 0) return 1;
  const percent = earned / max;
  if (percent >= 0.9) return 3;
  if (percent >= 0.6) return 2;
  return 1;
}

/** Lesson complete: reward stars, what's new, and the choice to replay or head home. */
export function CompleteStep({ lesson, onPlayAgain, onContinue }: CompleteStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const progress = useAppStore((state) => state.progress);
  const lessonProgress = progress.find((entry) => entry.lessonId === lesson.id);
  const { earned, max } = lessonStars(lesson, lessonProgress);
  const rating = ratingStars(earned, max);
  const minigame = lesson.boss ? services.deps.content.minigame(lesson.boss) : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-cream px-6 py-10 text-center">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{t('complete.title')}</h1>
      <StarsRow earned={rating} size="4rem" animate />
      <div className="rounded-full bg-[#FBEFD3] px-6 py-3 font-display text-lg font-bold text-[#6E4A07]">
        {t('complete.stars-pill', { count: earned })}
      </div>

      {minigame && (
        <div className="info-flat flex w-full max-w-md items-center gap-4 rounded-3xl bg-card p-5 text-left">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[#DCEFE3]">
            <NewGameIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {t('complete.new-in-play')}
            </span>
            <span className="font-display text-xl text-ink">{tContent(t, minigame.titleKey)}</span>
          </div>
        </div>
      )}

      <div className="mt-auto flex w-full max-w-lg gap-4 pt-6">
        <button
          type="button"
          onClick={onPlayAgain}
          className="tap-raised h-20 flex-1 rounded-3xl bg-card font-display text-xl font-semibold text-ink"
        >
          {t('play-again')}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="tap-raised tap-go h-20 flex-1 rounded-3xl bg-go font-display text-xl font-semibold text-white"
        >
          {t('continue')}
        </button>
      </div>
    </main>
  );
}
