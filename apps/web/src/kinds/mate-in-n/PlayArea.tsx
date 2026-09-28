import type { JSX } from 'react';
import { chessWeb } from '../../chess-pack.ts';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import type { PlayAreaProps } from '../kind-ui.ts';
import { moveKindLegalMoves } from '../kind-ui.ts';
import { MoveBoard } from '../MoveBoard.tsx';

export function PlayArea({
  state,
  dispatch,
  checkSquare,
  showHint,
  pieceBadges,
  top,
  done,
}: PlayAreaProps<'mate-in-n'>): JSX.Element {
  const solved = state.core.solved;
  // While the reply is pending, the board shows the position right after the kid's own move (not
  // the reply, already applied in `state.core`) until `reveal` fires; `state.lastMove` already
  // highlights the kid's own move by then (set by `toUi`'s `moved` patch).
  const displayPosition = state.pending ? state.pending.position : state.core.position;

  const board = (
    <MoveBoard
      position={displayPosition}
      legalMoves={state.pending ? [] : moveKindLegalMoves(state.core, chessWeb.core.context)}
      onMove={(move) => {
        dispatch({ type: 'move', move });
      }}
      onTapFirst={() => {
        dispatch({ type: 'tap-first' });
      }}
      hint={state.hint}
      lastMove={state.lastMove}
      wrongMove={state.wrongMove}
      checkSquare={checkSquare}
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
