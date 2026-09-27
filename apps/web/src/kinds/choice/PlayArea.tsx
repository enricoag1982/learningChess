import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../ui/board/Board.tsx';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import type { PlayAreaProps } from '../kind-ui.ts';
import { ChoiceOptions } from './ChoiceOptions.tsx';

export function PlayArea({
  def,
  state,
  dispatch,
  checkSquare,
  showHint,
  pieceBadges,
  top,
  done,
}: PlayAreaProps<'choice'>): JSX.Element {
  const { t } = useTranslation();
  const solved = state.core.solved;

  // A choice exercise's board is opt-in (`def.showBoard`) — `ExerciseFrame` gives a hidden board
  // the panel's full width instead of leaving an empty board-shaped gap.
  const board = def.showBoard ? (
    <Board
      position={state.core.position}
      legalMoves={[]}
      highlights={checkSquare === undefined ? {} : { check: checkSquare }}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  ) : null;

  const controls = (
    <>
      <ExerciseControls
        showHint={showHint}
        onHint={() => {
          dispatch({ type: 'hint' });
        }}
      />
      <ChoiceOptions
        options={def.options}
        wrongOptionIds={state.core.wrongOptions ?? []}
        onPick={(optionId) => {
          dispatch({ type: 'answer-choice', optionId });
        }}
      />
    </>
  );

  return <ExerciseFrame board={board} panel={panelBody(top, solved, done, controls)} />;
}
