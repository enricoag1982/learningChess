import type { JSX } from 'react';
import type { ActionOf, DefOf, ExerciseStateOf, Hint } from '@learn/subject-chess';
import { chessWeb, checkSquareFor, useSurfacePieceBadges } from '../../chess-pack.ts';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import type { PlayAreaProps } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { moveKindLegalMoves } from '../move-ui.ts';
import { MoveBoard } from '../MoveBoard.tsx';

export function PlayArea({
  state,
  dispatch,
  showHint,
  showCheck,
  surface,
  top,
  done,
}: PlayAreaProps<
  DefOf<'best-move'>,
  ExerciseStateOf<DefOf<'best-move'>>,
  ActionOf<'best-move'>,
  MoveExtra
>): JSX.Element {
  const pieceBadges = useSurfacePieceBadges(surface);
  const solved = state.core.solved;

  const board = (
    <MoveBoard
      position={state.core.position}
      legalMoves={moveKindLegalMoves(state.core, chessWeb.core.context)}
      onMove={(move) => {
        dispatch({ type: 'move', move });
      }}
      onTapFirst={() => {
        dispatch({ type: 'tap-first' });
      }}
      // `useExerciseSession` (generic) types `state.hint` by its base shape; the pack's own
      // registry narrows `def.type` to a chess kind at runtime, so this always is one.
      hint={state.hint as Hint | null}
      lastMove={state.lastMove}
      wrongMove={state.wrongMove}
      checkSquare={showCheck ? checkSquareFor(state.core.position) : undefined}
      pieceBadges={pieceBadges}
    />
  );

  const controls = (
    <ExerciseControls
      showHint={showHint}
      onHint={() => {
        dispatch({ type: 'hint' });
      }}
    />
  );

  return <ExerciseFrame board={board} panel={panelBody(top, solved, done, controls)} />;
}
