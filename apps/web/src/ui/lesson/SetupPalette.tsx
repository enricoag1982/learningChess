import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hint, PalettePiece, Piece } from '@chess-kids/core';
import { PieceIcon } from '../board/pieces.tsx';

export interface SetupPaletteProps {
  readonly palette: readonly PalettePiece[];
  /** Currently selected palette piece (tap a square next to place it), if any. */
  readonly selected: Piece | null;
  /** Active hint, if any: highlights the suggested piece (levels 1–2). */
  readonly hint: Hint | null;
  readonly onSelect: (piece: Piece) => void;
  /** One non-wrapping, horizontally scrollable row (phone / iPad portrait, under the board); default wraps for the side panel. */
  readonly compact?: boolean;
}

function pieceKey(piece: { readonly color: string; readonly type: string }): string {
  return `${piece.color}${piece.type}`;
}

/** Setup exercise's piece tray: tap a piece here, then a square on the board, to place it. */
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
    <div className="flex flex-col gap-2 rounded-3xl border-2 border-line bg-card p-4">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted sm:text-sm">
        {t('exercise.setup.palette-label')}
      </span>
      <div className={`flex gap-3 ${compact ? 'flex-nowrap overflow-x-auto pb-1' : 'flex-wrap'}`}>
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
              className={`tap-raised relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border-4 bg-board-light ${
                isSelected ? 'border-go' : isHinted ? 'border-dashed border-today' : 'border-line'
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
