import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hint } from '../../core/exercise/hint.ts';
import type { PalettePiece } from './kind.ts';
import type { Piece } from '../../core/chess/types.ts';
import { PieceIcon } from '../../web/ui/board/pieces.tsx';

export interface SetupPaletteProps {
  readonly palette: readonly PalettePiece[];
  readonly selected: Piece | null;
  readonly hint: Hint | null;
  readonly onSelect: (piece: Piece) => void;
  /** One non-wrapping, horizontally scrollable row (phone / iPad portrait, under the board); default wraps for the side panel. */
  readonly compact?: boolean;
}

function pieceKey(piece: { readonly color: string; readonly type: string }): string {
  return `${piece.color}${piece.type}`;
}

export function SetupPalette({
  palette,
  selected,
  hint,
  onSelect,
  compact = false,
}: SetupPaletteProps): JSX.Element {
  const { t } = useTranslation();
  const hintedKey = hint?.kind === 'setup' && hint.piece ? pieceKey(hint.piece) : null;

  return (
    // Flat, no border (docs/screens.md §1): a row of raised piece buttons, so a card border would compete.
    // Under the board (`compact`) the label sits left of the tiles from `sm` up, saving a line of board height.
    <div
      className={`info-flat flex flex-col gap-2 rounded-3xl bg-[#F3EDE0] p-3 ${compact ? 'sm:flex-row sm:items-center sm:gap-4' : ''}`}
    >
      <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-muted sm:text-sm">
        {t('exercise.setup.palette-label')}
      </span>
      <div
        className={`flex gap-3 ${compact ? 'min-w-0 flex-nowrap overflow-x-auto pb-1' : 'flex-wrap'}`}
      >
        {palette.map((entry) => {
          const key = pieceKey(entry);
          const isSelected = selected !== null && pieceKey(selected) === key;
          const isHinted = !isSelected && hintedKey === key;
          const label = t('exercise.setup.palette-item', {
            color: t(`board.color.${entry.color}`),
            piece: t(`board.piece.${entry.type}`),
            count: entry.count,
          });
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => {
                onSelect({ color: entry.color, type: entry.type });
              }}
              className={`tap-raised relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border-4 bg-board-light ${
                isSelected
                  ? 'border-go'
                  : isHinted
                    ? 'border-dashed border-today'
                    : 'border-edge-neutral'
              }`}
            >
              <span className="h-10 w-10">
                <PieceIcon piece={{ color: entry.color, type: entry.type }} />
              </span>
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-line bg-card px-1 text-xs font-extrabold text-ink"
              >
                {entry.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
