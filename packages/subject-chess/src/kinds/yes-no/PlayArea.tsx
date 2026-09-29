import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hint } from '../../core/exercise/hint.ts';
import { checkSquareFor, useSurfacePieceBadges } from '../../web/chess-pack.ts';
import { Board } from '../../web/ui/board/Board.tsx';
import { ExerciseFrame } from '@learn/platform-web/kinds/ExercisePlay.tsx';
import { panelBody } from '@learn/platform-web/kinds/panel-body.tsx';
import { ExerciseControls } from '@learn/platform-web/kinds/ExerciseControls.tsx';
import type { ChessPlayAreaProps } from '../../web/kinds/move-ui.ts';
import { hintSquares } from '../../web/kinds/move-ui.ts';
import type { YesNoExtra } from './ui.ts';
import { YesNoButtons } from './YesNoButtons.tsx';

export function PlayArea({
  def,
  state,
  dispatch,
  showHint,
  showCheck,
  surface,
  top,
  done,
}: ChessPlayAreaProps<'yes-no', YesNoExtra>): JSX.Element {
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
      highlights={{
        focus: def.focus ? [def.focus] : [],
        ...(hintSquares(hint) ? { hint: hintSquares(hint) } : {}),
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
