import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../ui/board/Board.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { hintSquares } from '../kind-ui.ts';
import type { PlayAreaProps } from '../kind-ui.ts';
import { YesNoButtons } from './YesNoButtons.tsx';

export function PlayArea({
  def,
  state,
  dispatch,
  checkSquare,
  showHint,
  pieceBadges,
  top,
  done,
}: PlayAreaProps<'yes-no'>): JSX.Element {
  const { t } = useTranslation();
  const solved = state.core.solved;

  const board = (
    <Board
      position={state.core.position}
      legalMoves={[]}
      highlights={{
        focus: def.focus ? [def.focus] : [],
        ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
        ...(state.lastMove ? { lastMove: state.lastMove } : {}),
        ...(checkSquare === undefined ? {} : { check: checkSquare }),
      }}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  );

  const controls = (
    <>
      <ExerciseControls
        showHint={showHint}
        onHint={() => {
          dispatch({ type: 'hint' });
        }}
      />
      <YesNoButtons
        wrongValue={state.wrongAnswer}
        onAnswer={(value) => {
          dispatch({ type: 'answer-yes-no', value });
        }}
      />
    </>
  );

  return <ExerciseFrame board={board} panel={panelBody(top, solved, done, controls)} />;
}
