import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../app/store.ts';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { Screen } from './ds/Screen.tsx';

/** Placement's own closing summary (domain-model.md §3.2): how many Basics worlds were passed. */
function PlacementSummary({
  passedCount,
  totalWorlds,
  onContinue,
}: {
  readonly passedCount: number;
  readonly totalWorlds: number;
  readonly onContinue: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const allPassed = passedCount > 0 && passedCount === totalWorlds;
  const titleKey =
    passedCount === 0
      ? 'placement.summary-none-title'
      : allPassed
        ? 'placement.summary-all-title'
        : 'placement.summary-passed-title';
  const bodyText =
    passedCount === 0
      ? t('placement.summary-none-body')
      : allPassed
        ? t('placement.summary-all-body')
        : t('placement.summary-passed-body', { count: passedCount });
  return (
    <Screen kind="center" className="gap-6 px-6 py-10">
      <div className="celebration-pop flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] border-2 border-go bg-[#E3F1EA] p-6 sm:p-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{t(titleKey)}</h1>
        <NarratedBubble text={bodyText} layout="column" className="text-left" />
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="h-20 w-full max-w-md rounded-3xl bg-go font-display text-xl font-semibold text-white"
      >
        {t('placement.continue')}
      </button>
    </Screen>
  );
}

/**
 * The placement test (domain-model.md §3.2): one run per Basics world in order, stopping at the
 * first failed world; the kid can close it (top-bar X) at any point and keeps whatever already
 * passed. Reuses the review task runner per world, same as a world test-out (`showHint={false}`).
 */
export function PlacementScreen(): JSX.Element {
  const { t } = useTranslation();
  const placementPlan = useAppStore((state) => state.placementPlan);
  const placementIndex = useAppStore((state) => state.placementIndex);
  const submitPlacementWorldRun = useAppStore((state) => state.submitPlacementWorldRun);
  const advancePlacementWorld = useAppStore((state) => state.advancePlacementWorld);
  const finishPlacement = useAppStore((state) => state.finishPlacement);

  const resultsRef = useRef<boolean[]>([]);
  const [passedCount, setPassedCount] = useState(0);
  const [done, setDone] = useState(false);

  const current = placementPlan[placementIndex];

  if (done || !current) {
    return (
      <PlacementSummary
        passedCount={passedCount}
        totalWorlds={placementPlan.length}
        onContinue={finishPlacement}
      />
    );
  }

  return (
    <ReviewTaskRunner
      key={placementIndex}
      tasks={current.tasks}
      headerText={(taskIndex, taskTotal) =>
        t('placement.world-of', {
          order: current.world.order,
          current: taskIndex,
          total: taskTotal,
        })
      }
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
        void submitPlacementWorldRun(current.world.id, results).then((score) => {
          if (!score.passed) {
            setDone(true);
            return;
          }
          setPassedCount((count) => count + 1);
          if (placementIndex + 1 < placementPlan.length) {
            advancePlacementWorld();
          } else {
            setDone(true);
          }
        });
      }}
      onClose={finishPlacement}
    />
  );
}
