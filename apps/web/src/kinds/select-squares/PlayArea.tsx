import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../ui/board/Board.tsx';
import { PRIMARY_BUTTON } from '../../ui/lesson/button-styles.ts';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import { hintSquares } from '../kind-ui.ts';
import type { PlayAreaProps } from '../kind-ui.ts';

export function PlayArea({
  state,
  dispatch,
  checkSquare,
  showHint,
  pieceBadges,
  top,
  done,
}: PlayAreaProps<'select-squares'>): JSX.Element {
  const { t } = useTranslation();
  const solved = state.core.solved;

  const board = (
    <Board
      position={state.core.position}
      legalMoves={[]}
      onSquareTap={(square) => {
        dispatch({ type: 'toggle', square });
      }}
      highlights={{
        selectedSquares: state.core.selected,
        wrong: state.wrongSquares.filter((square) => state.core.selected.includes(square)),
        missed: state.missedSquares.filter((square) => !state.core.selected.includes(square)),
        ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
        ...(checkSquare === undefined ? {} : { check: checkSquare }),
      }}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  );

  const controls = (
    <ExerciseControls
      showHint={showHint}
      onHint={() => {
        dispatch({ type: 'hint' });
      }}
      slot={
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'submit' });
          }}
          className={PRIMARY_BUTTON}
        >
          {t('exercise.check')}
        </button>
      }
    />
  );

  return <ExerciseFrame board={board} panel={panelBody(top, solved, done, controls)} />;
}
