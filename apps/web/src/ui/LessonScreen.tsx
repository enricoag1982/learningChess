import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  advanceLessonPhase,
  isSkippablePhase,
  lessonSteps,
  phaseEndIndex,
  skipLessonPhase,
  stepPhase,
  totalStars,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { BossStep } from './lesson/BossStep.tsx';
import { CompleteStep } from './lesson/CompleteStep.tsx';
import { DemoStep } from './lesson/DemoStep.tsx';
import { ExerciseStep } from './lesson/ExerciseStep.tsx';
import { PhaseChip } from './lesson/PhaseChip.tsx';
import { StepPills } from './lesson/StepPills.tsx';
import { StoryStep } from './lesson/StoryStep.tsx';
import { StarsPill } from './StarsPill.tsx';
import { useIsCompact } from './useMediaQuery.ts';

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Exercise stage dots + "N of M", shown only while working through the scored exercises. */
function StageDots({
  current,
  total,
  showLabel = true,
}: {
  readonly current: number;
  readonly total: number;
  /** Hidden when the phone top-bar chip already states the count, to avoid saying it twice. */
  readonly showLabel?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <span
            key={index}
            className={`h-3 w-3 rounded-full border-2 ${
              state === 'done'
                ? 'border-go bg-go'
                : state === 'current'
                  ? 'border-today bg-white'
                  : 'border-[#E8DFC9] bg-[#E8DFC9]'
            }`}
          />
        );
      })}
      {showLabel && (
        <span className="ml-2 text-sm font-extrabold text-muted">
          {t('lesson.stage-of', { current: current + 1, total })}
        </span>
      )}
    </div>
  );
}

/** The whole lesson session: top chrome (close, step pills, stars) plus the current step. */
export function LessonScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const isCompact = useIsCompact();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const lessonId = useAppStore((state) => state.lessonId);
  const stepIndex = useAppStore((state) => state.stepIndex);
  const goToStep = useAppStore((state) => state.goToStep);
  const exitLesson = useAppStore((state) => state.exitLesson);
  const completeLessonActivity = useAppStore((state) => state.completeLessonActivity);
  const checkForCelebrations = useAppStore((state) => state.checkForCelebrations);
  const refreshProgress = useAppStore((state) => state.refreshProgress);

  const lesson = lessonId ? services.deps.content.lesson(lessonId) : undefined;
  const steps = useMemo(
    () => (lesson ? lessonSteps(lesson, services.deps.content.minigames()) : []),
    [lesson, services],
  );
  const step = steps[stepIndex];

  // rewards.md §4 "lesson complete" celebration moment: the exercise/boss use cases already wrote
  // any newly earned badge (`checkRewards`, app layer) by the time this step renders — this just
  // picks it up and queues it (`checkForCelebrations`), capped and deduped by the store itself.
  useEffect(() => {
    if (step?.kind === 'complete') {
      void checkForCelebrations();
    }
  }, [step?.kind, checkForCelebrations]);

  if (!lesson || !step || !profile) {
    return <main className="min-h-screen bg-cream" />;
  }

  if (step.kind === 'complete') {
    return (
      <CompleteStep
        lesson={lesson}
        onPlayAgain={() => {
          goToStep(0);
        }}
        onContinue={() => {
          void completeLessonActivity();
        }}
      />
    );
  }

  function advanceFromCurrent(): void {
    const next = stepIndex + 1;
    goToStep(next);
    const currentStep = steps[stepIndex];
    if (!lesson || !profile || !currentStep) return;
    const currentPhase = stepPhase(currentStep);
    if (!isSkippablePhase(currentPhase)) return;
    void advanceLessonPhase(services.deps, profile.id, lesson.id, currentPhase, next).then(() => {
      void refreshProgress();
    });
  }

  // "Skip" (playtest 2, teaching-process.md §2): Story/Demo/Try only. Narration stops immediately;
  // the mark is saved and `progress` refreshed *before* the step jumps, so `StepPills` never shows
  // the old step as "done" for a frame on its way to "skipped".
  function skipPhase(): void {
    const currentStep = steps[stepIndex];
    if (!lesson || !profile || !currentStep) return;
    const currentPhase = stepPhase(currentStep);
    if (!isSkippablePhase(currentPhase)) return;
    services.narrator.cancel();
    const target = phaseEndIndex(steps, stepIndex);
    void skipLessonPhase(services.deps, profile.id, lesson.id, currentPhase, target).then(() => {
      void refreshProgress().then(() => {
        goToStep(target);
      });
    });
  }

  const phase = stepPhase(step);
  const stars = totalStars(progress);
  const lessonProgress = progress.find((entry) => entry.lessonId === lessonId);
  const skippedPhases = lessonProgress?.skippedPhases;
  // Try's last guided step (its own `nextStepIndex` leaves the `try` phase): unmarks a previous
  // "Skip" on replay (`recordExerciseResult`'s `completesPhase`), same "phase later completed
  // normally" rule `advanceFromCurrent` applies to Story/Demo above.
  const nextStep = steps[stepIndex + 1];
  const completesTry =
    step.kind === 'guided' && nextStep !== undefined && stepPhase(nextStep) !== 'try';
  // Scored exercises also show "N of M" via StageDots underneath; on the compact phone bar that
  // row drops its own label (`showLabel={!isCompact}` below) so the count is stated once, not twice.
  const chipCounts =
    step.kind === 'guided'
      ? { current: step.index + 1, total: lesson.guided.length }
      : step.kind === 'exercise'
        ? { current: step.index + 1, total: lesson.exercises.length }
        : undefined;

  return (
    <main className="flex h-dvh flex-col gap-3 overflow-y-auto bg-cream px-3 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={t('lesson.close')}
          onClick={exitLesson}
          className="tap-raised flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-card text-ink"
        >
          <CloseIcon />
        </button>
        <div className="min-w-0 flex-1 overflow-x-auto">
          {phase &&
            (isCompact ? (
              <PhaseChip phase={phase} current={chipCounts?.current} total={chipCounts?.total} />
            ) : (
              <StepPills current={phase} skippedPhases={skippedPhases} />
            ))}
        </div>
        <StarsPill count={stars} />
      </div>

      {step.kind === 'exercise' && (
        <StageDots current={step.index} total={lesson.exercises.length} showLabel={!isCompact} />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {step.kind === 'story' && (
          <StoryStep lesson={lesson} onNext={advanceFromCurrent} onSkip={skipPhase} />
        )}
        {step.kind === 'demo' && (
          <DemoStep lesson={lesson} onNext={advanceFromCurrent} onSkip={skipPhase} />
        )}
        {(step.kind === 'guided' || step.kind === 'exercise') && (
          <ExerciseStep
            key={step.exercise.id}
            lesson={lesson}
            exercise={step.exercise}
            guided={step.kind === 'guided'}
            nextStepIndex={stepIndex + 1}
            onSkip={step.kind === 'guided' ? skipPhase : undefined}
            completesPhase={completesTry ? 'try' : undefined}
          />
        )}
        {step.kind === 'boss' && (
          <BossStep
            key={step.game.id}
            lesson={lesson}
            game={step.game}
            nextStepIndex={stepIndex + 1}
          />
        )}
      </div>
    </main>
  );
}
