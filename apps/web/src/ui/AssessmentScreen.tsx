import { useRef, useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { AssessmentScope, AssessmentScore } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import type { Services } from '../app/services.ts';
import { characterName, tContent } from '../content-text.ts';
import { characterPieceOrNull } from './art/character-meta.ts';
import { ReplayButton } from './ReplayButton.tsx';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { useNarratedText } from './useNarratedText.ts';

/** Scope's display name, for the result screen's headline. */
function scopeName(t: TFunction, scope: AssessmentScope, services: Services): string {
  if (scope.type === 'lesson') {
    const lesson = services.deps.content.lesson(scope.lessonId);
    if (!lesson) return '';
    return characterPieceOrNull(lesson.character) === null
      ? tContent(t, lesson.titleKey)
      : characterName(t, lesson.character);
  }
  const world = services.deps.content
    .catalog?.()
    .tracks.flatMap((track) => track.worlds)
    .find((entry) => entry.id === scope.worldId);
  return world ? tContent(t, world.titleKey) : '';
}

/** Pass/fail result (domain-model.md §3.2 "Pass"/"Fail"): pass unlocks + confetti-lite, fail
 * encourages, no penalty — both return to the Journey. */
function AssessmentResult({
  outcome,
  scope,
  onContinue,
}: {
  readonly outcome: AssessmentScore;
  readonly scope: AssessmentScope;
  readonly onContinue: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const name = scopeName(t, scope, services);
  const lessonCount =
    scope.type === 'lesson'
      ? 1
      : services.deps.content.lessons().filter((lesson) => lesson.world === scope.worldId).length;

  const bubbleText = outcome.passed
    ? t('assessment.pass-body', { count: lessonCount, name })
    : t('assessment.fail-body');
  const replay = useNarratedText(services.narrator, bubbleText);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream px-6 py-10 text-center">
      <div
        className={`celebration-pop flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] border-2 p-6 sm:p-8 ${
          outcome.passed ? 'border-go bg-[#E3F1EA]' : 'border-line bg-card'
        }`}
      >
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          {t(outcome.passed ? 'assessment.pass-title' : 'assessment.fail-title')}
        </h1>
        <div className="flex w-full flex-col items-stretch gap-3 text-left">
          <SpeechBubble text={bubbleText} />
          <ReplayButton onClick={replay} label={t('exercise.replay')} />
        </div>
        <p className="text-base font-semibold text-muted">
          {t('assessment.score', { correct: outcome.correct, total: outcome.total })}
        </p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="h-20 w-full max-w-md rounded-3xl bg-go font-display text-xl font-semibold text-white"
      >
        {t('assessment.continue')}
      </button>
    </main>
  );
}

/**
 * Test-out run (domain-model.md §3.2): reuses the review task runner (`showHint={false}`, no
 * easier variants — the runner never offers one), scoring the whole run via `onRecord` rather than
 * moving the Leitner review box per task. Shows the pass/fail result once done, then returns to the
 * Journey (`exitAssessment`, which refreshes progress).
 */
export function AssessmentScreen(): JSX.Element {
  const { t } = useTranslation();
  const assessmentRun = useAppStore((state) => state.assessmentRun);
  const submitAssessmentRun = useAppStore((state) => state.submitAssessmentRun);
  const exitAssessment = useAppStore((state) => state.exitAssessment);
  const resultsRef = useRef<boolean[]>([]);
  const [outcome, setOutcome] = useState<AssessmentScore | null>(null);

  if (!assessmentRun) {
    return <main className="min-h-screen bg-cream" />;
  }

  if (outcome) {
    return (
      <AssessmentResult outcome={outcome} scope={assessmentRun.scope} onContinue={exitAssessment} />
    );
  }

  return (
    <ReviewTaskRunner
      tasks={assessmentRun.tasks}
      headerText={(current, total) => t('assessment.task-of', { current, total })}
      closeAriaLabel={t('session.leave')}
      reviewSource="practice"
      showHint={false}
      onRecord={(_task, _state, correct) => {
        resultsRef.current.push(correct);
        return Promise.resolve();
      }}
      onDone={() => {
        const results = resultsRef.current;
        resultsRef.current = [];
        void submitAssessmentRun(results).then((score) => {
          setOutcome(score);
        });
      }}
      onClose={exitAssessment}
    />
  );
}
