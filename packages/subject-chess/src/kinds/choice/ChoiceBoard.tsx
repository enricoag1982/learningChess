import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { checkSquareFor } from '../../web/chess-pack.ts';
import { Board } from '../../web/ui/board/Board.tsx';
import type { WrongSquaresExtra, ChessPlayAreaProps } from '../../web/kinds/move-ui.ts';

/** A choice exercise's board is opt-in (`def.showBoard`): without it the options take the panel's full width. */
export function ChoiceBoard({
  def,
  state,
  showCheck,
}: ChessPlayAreaProps<'choice', WrongSquaresExtra>): JSX.Element | null {
  const { t } = useTranslation();
  if (!def.showBoard) {
    return null;
  }
  const checkSquare = showCheck ? checkSquareFor(state.core.position) : undefined;
  return (
    <Board
      position={state.core.position}
      legalMoves={[]}
      highlights={checkSquare === undefined ? {} : { check: checkSquare }}
      label={t('lesson.board-label')}
    />
  );
}
