import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Piece, Square } from '@chess-kids/core/chess';
import { setupPalette } from '@chess-kids/core/chess';
import { Board } from '../../ui/board/Board.tsx';
import { useIsStackedLayout } from '../../ui/useMediaQuery.ts';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import { panelBody } from '../panel-body.tsx';
import type { PlayAreaProps } from '../kind-ui.ts';
import { SetupPalette } from './SetupPalette.tsx';

export function PlayArea({
  state,
  dispatch,
  checkSquare,
  showHint,
  pieceBadges,
  top,
  done,
}: PlayAreaProps<'setup'>): JSX.Element {
  const { t } = useTranslation();
  const isStacked = useIsStackedLayout();
  // The palette piece currently selected, waiting for a square tap — setup's own UI-only state.
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const solved = state.core.solved;
  const setupHint = state.hint?.kind === 'setup' ? state.hint : null;

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

  // Stacked layout (phone / iPad portrait): the tray goes directly under the board (`belowBoard`,
  // M2.4 §2b) instead of the controls row.
  const tray = (
    <SetupPalette
      palette={setupPalette(state.core)}
      selected={selectedPiece}
      hint={state.hint}
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
