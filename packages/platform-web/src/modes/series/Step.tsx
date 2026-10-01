import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ExerciseDefBase,
  ExerciseStateBase,
  MiniGameBase,
  SeriesGameDef,
  SeriesGameState,
} from '@learn/platform-core';
import { completeRound, currentRound, startSeries } from '@learn/platform-core';
import { useAppStore, useServices } from '../../app/store.ts';
import { usePack } from '../../app/subject.ts';
import { tContent } from '../../content-text.ts';
import { ExercisePlay } from '../../kinds/ExercisePlay.tsx';
import { useExerciseSession } from '../../kinds/session.ts';
import { SpeechBubble } from '../../ui/ds/SpeechBubble.tsx';
import { INFO_CHIP } from '../../ui/ds/primitives-styles.ts';
import { useNarratedText } from '../../ui/ds/useNarratedText.ts';
import { GameLayout } from '../../ui/lesson/GameLayout.tsx';
import { NextButton } from '../../ui/lesson/NextButton.tsx';
import { BossResultPanel, useBossRun } from '../boss-run.tsx';
import type { BossStepProps } from '../mode-ui.ts';

type SeriesGame = MiniGameBase & SeriesGameDef;

/** Round counter + mistakes-so-far card, shared by a round in progress and the result screen. */
function SeriesCounters({
  current,
  total,
  mistakes,
}: {
  readonly current: number;
  readonly total: number;
  readonly mistakes: number;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className={INFO_CHIP}>
      <span>{t('boss.series.round-of', { current, total })}</span>
      <span>{t('boss.series.mistakes', { count: mistakes })}</span>
    </div>
  );
}

interface SeriesRoundProps {
  readonly character: string;
  readonly exercise: ExerciseDefBase;
  readonly roundNumber: number;
  readonly totalRounds: number;
  /** Mistakes already folded in from every round completed before this one. */
  readonly priorMistakes: number;
  readonly onNext: (roundState: ExerciseStateBase) => void;
}

/** One round of a series boss: `ExerciseStep`'s UI, scored only in the series' total mistakes; moving on is an explicit "Next" tap. */
function SeriesRound({
  character,
  exercise,
  roundNumber,
  totalRounds,
  priorMistakes,
  onNext,
}: SeriesRoundProps): JSX.Element {
  const hintsEnabled = useAppStore((state) => state.activeProfileSettings.hints);

  // No save: a series round scores only as part of the series' total mistakes.
  const {
    state,
    dispatch,
    solved,
    instruction: instructionText,
    note,
    replay,
  } = useExerciseSession(exercise, { character });

  // Live running total: mistakes already folded in from earlier rounds, plus this round's own
  // errors and hint level so far (folded in for real once it is solved — see `completeRound`).
  const liveMistakes = priorMistakes + state.core.errors + state.core.hintLevel;

  const top = (
    <>
      <SpeechBubble text={instructionText} note={note} onReplay={replay} />
      <SeriesCounters current={roundNumber} total={totalRounds} mistakes={liveMistakes} />
    </>
  );

  const done = solved ? (
    <div className="mt-auto flex flex-col items-center gap-4">
      <NextButton
        onClick={() => {
          onNext(state.core);
        }}
        className="w-full"
      />
    </div>
  ) : null;

  return (
    <ExercisePlay
      def={exercise}
      state={state}
      dispatch={dispatch}
      showHint={hintsEnabled}
      showCheck
      top={top}
      done={done}
    />
  );
}

/** A series boss: fixed rounds through the exercise engine, scored on total mistakes (errors + hint levels) across all rounds. */
export function Step({
  lesson,
  game: minigame,
  nextStepIndex,
  session,
}: BossStepProps<SeriesGame>): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const pack = usePack();
  const goToStep = useAppStore((state) => state.goToStep);
  const kinds = services.deps.subject.kinds;

  const [series, setSeries] = useState<SeriesGameState>(() => startSeries(minigame, kinds));
  const run = useBossRun(series, { lesson, nextStepIndex, session });
  const goalText = tContent(t, minigame.goalKey);
  const replay = useNarratedText(services.narrator, goalText);

  function handleRoundNext(roundState: ExerciseStateBase): void {
    setSeries((current) => completeRound(current, roundState, kinds));
  }

  /** Standalone-only: restarts the series at its first round (a lesson boss never restarts inline). */
  function handlePlayAgain(): void {
    setSeries(startSeries(minigame, kinds));
    run.restart();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
      <h2 className="text-center font-display text-xl text-ink sm:text-3xl">
        {tContent(t, minigame.titleKey)}
      </h2>
      {!run.isOver ? (
        <SeriesRound
          key={series.roundIndex}
          character={lesson.character}
          exercise={currentRound(series)}
          roundNumber={series.roundIndex + 1}
          totalRounds={minigame.rounds.length}
          priorMistakes={series.mistakes}
          onNext={handleRoundNext}
        />
      ) : (
        <GameLayout
          board={<pack.surface.View state={series.round} />}
          panel={
            <>
              <SpeechBubble text={goalText} onReplay={replay} />
              <SeriesCounters
                current={minigame.rounds.length}
                total={minigame.rounds.length}
                mistakes={series.mistakes}
              />
              <BossResultPanel
                stars={run.stars}
                saved={run.saved}
                alwaysPlayAgain={false}
                session={session}
                onPlayAgain={handlePlayAgain}
                onNext={() => {
                  goToStep(nextStepIndex);
                }}
              />
            </>
          }
        />
      )}
    </div>
  );
}
