import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hint } from '../../core/exercise/hint.ts';
import type { Piece, Square } from '../../core/chess/types.ts';
import { setupPalette } from './engine.ts';
import { checkSquareFor, useSurfacePieceBadges } from '../../web/chess-pack.ts';
import { Board } from '../../web/ui/board/Board.tsx';
import { useIsStackedLayout } from '@learn/platform-web/ui/useMediaQuery.ts';
import { ExerciseControls } from '@learn/platform-web/kinds/ExerciseControls.tsx';
import { ExerciseFrame } from '@learn/platform-web/kinds/ExercisePlay.tsx';
import { panelBody } from '@learn/platform-web/kinds/panel-body.tsx';
import type { WrongSquaresExtra, ChessPlayAreaProps } from '../../web/kinds/move-ui.ts';
import { SetupPalette } from './SetupPalette.tsx';

export function PlayArea({
  state,
  dispatch,
  showHint,
  showCheck,
  surface,
  top,
  done,
  actions,
}: ChessPlayAreaProps<'setup', WrongSquaresExtra>): JSX.Element {
  const { t } = useTranslation();
  const pieceBadges = useSurfacePieceBadges(surface);
  const isStacked = useIsStackedLayout();
  // The palette piece currently selected, waiting for a square tap — setup's own UI-only state.
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const solved = state.core.solved;
  // `useExerciseSession` (generic) types `state.hint` by its base shape; the pack's own registry
  // narrows `def.type` to a chess kind at runtime, so this always is one.
  const hint = state.hint as Hint | null;
  const setupHint = hint?.kind === 'setup' ? hint : null;
  const checkSquare = showCheck ? checkSquareFor(state.core.position) : undefined;

  function handlePlace(square: Square, piece: Piece): void {
    dispatch({ type: 'place', square, piece });
    setSelectedPiece(null);
  }

  const board = (
    <Board
      position={state.core.position}
      legalMoves={[]}
      onSquareTap={(square) => {
        if (selectedPiece) handlePlace(square, selectedPiece);
      }}
      highlights={{
        wrong: state.wrongSquares,
        ...(setupHint?.square ? { hint: [setupHint.square] } : {}),
        ...(checkSquare === undefined ? {} : { check: checkSquare }),
      }}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  );

  // Stacked layout (phone / iPad portrait): the tray goes under the board (`belowBoard`) instead of the controls row.
  const tray = (
    <SetupPalette
      palette={setupPalette(state.core)}
      selected={selectedPiece}
      hint={hint}
      onSelect={setSelectedPiece}
      compact={isStacked}
    />
  );

  const controls = (
    <>
      <ExerciseControls
        showHint={showHint}
        onHint={() => {
          dispatch({ type: 'hint' });
        }}
        extras={actions}
      />
      {!isStacked && tray}
    </>
  );

  return (
    <ExerciseFrame
      board={board}
      panel={panelBody(top, solved, done, controls)}
      belowBoard={solved ? undefined : isStacked ? tray : undefined}
    />
  );
}
