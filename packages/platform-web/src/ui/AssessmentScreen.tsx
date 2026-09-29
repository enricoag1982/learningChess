import { useRef, useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { AssessmentScope, AssessmentScore, SubjectCore } from '@learn/platform-core';
import { useAppStore, useRoute, useServices } from '../app/store.ts';
import type { Services } from '../app/services.ts';
import { usePack } from '../app/subject.ts';
import { characterName, tContent } from '../content-text.ts';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { BlankScreen, Screen } from './ds/Screen.tsx';

function scopeName(
  t: TFunction,
  scope: AssessmentScope,
  services: Services,
  characters: SubjectCore['characters'],
): string {
  if (scope.type === 'lesson') {
    const lesson = services.deps.content.lesson(scope.lessonId);
    if (!lesson) return '';
    return characters[lesson.character] === undefined
      ? tContent(t, lesson.titleKey)
      : characterName(t, lesson.character);
  }
  const world = services.deps.content
    .catalog?.()
    .tracks.flatMap((track) => track.worlds)
    .find((entry) => entry.id === scope.worldId);
  return world ? tContent(t, world.titleKey) : '';
}

/** Pass (domain-model.md §3.2) unlocks + confetti-lite; fail encourages, no penalty; both return to the Journey. */
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
  const pack = usePack();
  const name = scopeName(t, scope, services, pack.core.characters);
  const lessonCount =
    scope.type === 'lesson'
      ? 1
      : services.deps.content.lessons().filter((lesson) => lesson.world === scope.worldId).length;

  const bubbleText = outcome.passed
    ? t('assessment.pass-body', { count: lessonCount, name })
    : t('assessment.fail-body');

  return (
    <Screen kind="center" className="gap-6 px-6 py-10">
      <div
        className={`celebration-pop flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] border-2 p-6 sm:p-8 ${
          outcome.passed ? 'border-go bg-[#E3F1EA]' : 'border-line bg-card'
        }`}
      >
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          {t(outcome.passed ? 'assessment.pass-title' : 'assessment.fail-title')}
        </h1>
        <NarratedBubble text={bubbleText} layout="column" className="text-left" />
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
    </Screen>
  );
}

/** Test-out run (domain-model.md §3.2): reuses `ReviewTaskRunner` (no hints / easier variants), scoring the whole run via `onRecord`. */
export function AssessmentScreen(): JSX.Element {
  const { t } = useTranslation();
  const assessmentRun = useRoute('assessment');
  const submitAssessmentRun = useAppStore((state) => state.submitAssessmentRun);
  const exitAssessment = useAppStore((state) => state.exitAssessment);
  const resultsRef = useRef<boolean[]>([]);
  const [outcome, setOutcome] = useState<AssessmentScore | null>(null);

  if (!assessmentRun) {
    return <BlankScreen />;
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
