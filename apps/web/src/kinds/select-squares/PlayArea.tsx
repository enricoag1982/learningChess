import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionOf, DefOf, ExerciseStateOf, Hint } from '@chess-kids/core/chess';
import { checkSquareFor, useSurfacePieceBadges } from '../../chess-pack.ts';
import { Board } from '../../ui/board/Board.tsx';
import { PRIMARY_BUTTON } from '../../ui/lesson/button-styles.ts';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import { hintSquares } from '../move-ui.ts';
import type { PlayAreaProps } from '../kind-ui.ts';
import type { SelectSquaresExtra } from './ui.ts';

export function PlayArea({
  state,
  dispatch,
  showHint,
  showCheck,
  surface,
  top,
  done,
}: PlayAreaProps<
  DefOf<'select-squares'>,
  ExerciseStateOf<DefOf<'select-squares'>>,
  ActionOf<'select-squares'>,
  SelectSquaresExtra
>): JSX.Element {
  const { t } = useTranslation();
  const pieceBadges = useSurfacePieceBadges(surface);
  const solved = state.core.solved;
  const checkSquare = showCheck ? checkSquareFor(state.core.position) : undefined;
  // `useExerciseSession` (generic) types `state.hint` by its base shape; the pack's own registry
  // narrows `def.type` to a chess kind at runtime, so this always is one.
  const hint = state.hint as Hint | null;

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
        ...(hintSquares(hint) ? { hint: hintSquares(hint) } : {}),
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
