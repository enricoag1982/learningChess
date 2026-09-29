import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hint } from '../../core/exercise/hint.ts';
import type { Move } from '../../core/chess/rules.ts';
import type { Position, Square } from '../../core/chess/types.ts';
import { Board } from '../ui/board/Board.tsx';
import type { FromTo } from './move-ui.ts';
import { hintSquares } from './move-ui.ts';

export interface MoveBoardProps {
  readonly position: Position;
  readonly legalMoves: readonly Move[];
  /** A legal move, or an illegal one attempted from a known square — both dispatched as `move` and
   * left for the kind's own engine to accept or reject. */
  readonly onMove: (move: FromTo) => void;
  /** A tap with no piece selected yet (`IllegalAttempt.from === null`). */
  readonly onTapFirst: () => void;
  readonly hint: Hint | null;
  readonly lastMove?: FromTo;
  readonly wrongMove?: FromTo;
  readonly checkSquare?: Square;
  readonly pieceBadges: boolean;
}

/** The board shared by every move kind (collect-stars, capture, best-move, mate-in-n): legal-move
 * highlighting, hint ring, last-move and wrong-move marks, and the check ring. */
export function MoveBoard({
  position,
  legalMoves,
  onMove,
  onTapFirst,
  hint,
  lastMove,
  wrongMove,
  checkSquare,
  pieceBadges,
}: MoveBoardProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Board
      position={position}
      legalMoves={legalMoves}
      onMove={({ from, to }) => {
        onMove({ from, to });
      }}
      onIllegal={(attempt) => {
        if (attempt.from === null) {
          onTapFirst();
        } else {
          onMove({ from: attempt.from, to: attempt.to });
        }
      }}
      highlights={{
        ...(hintSquares(hint) ? { hint: hintSquares(hint) } : {}),
        ...(lastMove ? { lastMove } : {}),
        ...(wrongMove ? { wrongMove } : {}),
        ...(checkSquare === undefined ? {} : { check: checkSquare }),
      }}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  );
}
