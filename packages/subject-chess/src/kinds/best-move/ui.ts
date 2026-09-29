import type { MoveExtra, ChessKindUI } from '../../web/kinds/move-ui.ts';
import { baseInitUi, moveToUi } from '../../web/kinds/move-ui.ts';
import { MovePlayArea } from '../../web/kinds/MovePlayArea.tsx';

export const bestMoveUi: ChessKindUI<'best-move', MoveExtra> = {
  type: 'best-move',
  initUi: baseInitUi,
  clearWrongUi: () => ({ wrongSquares: [] }),
  toUi: moveToUi,
  PlayArea: MovePlayArea,
};
