import type { ChoiceLook } from '@learn/platform-web/kinds/choice/ChoiceOptions.tsx';
import type { ChoiceOption } from '../../core/exercise/types.ts';
import { PieceIcon } from '../../web/ui/board/pieces.tsx';

/** A piece option shows its icon and, with no text, is named "<color> <piece>" for screen readers. */
export const CHESS_CHOICE_LOOK: ChoiceLook<ChoiceOption> = {
  visual: ({ piece }) =>
    piece && (
      <span className="h-14 w-14 flex-shrink-0">
        <PieceIcon piece={piece} />
      </span>
    ),
  label: ({ piece }, text) =>
    piece && `${text(`board.color.${piece.color}`)} ${text(`board.piece.${piece.type}`)}`,
};
