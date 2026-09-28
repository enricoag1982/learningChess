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
}: PlayAreaProps<'best-move'>): JSX.Element {
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
