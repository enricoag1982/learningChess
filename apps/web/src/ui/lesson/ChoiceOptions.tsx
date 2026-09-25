import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChoiceOption } from '@chess-kids/core';
import { tContent } from '../../content-text.ts';
import { PieceIcon } from '../board/pieces.tsx';

export interface ChoiceOptionsProps {
  readonly options: readonly ChoiceOption[];
  /** Option ids already ruled out (wrong pick or hint-removed): orange, disabled. */
  readonly wrongOptionIds: readonly string[];
  readonly onPick: (optionId: string) => void;
}

/**
 * Choice exercise's pickable options: big tiles (icon over text) in a responsive grid — 2 per row
 * on a phone, up to 4 once there's room. Each tile is ≥ 64 px tall (min-h-24 ≈ 96 px) with a
 * ≥ 56 px icon, easily tappable and clearly readable for an 8-year-old.
 */
export function ChoiceOptions({
  options,
  wrongOptionIds,
  onPick,
}: ChoiceOptionsProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((option) => {
        const isWrong = wrongOptionIds.includes(option.id);
        // A piece-only option (no text) still needs a spoken name for screen readers.
        const pieceLabel = option.piece
          ? `${t(`board.color.${option.piece.color}`)} ${t(`board.piece.${option.piece.type}`)}`
          : undefined;
        return (
          <button
            key={option.id}
            type="button"
            disabled={isWrong}
            aria-disabled={isWrong}
            aria-label={option.textKey === undefined ? pieceLabel : undefined}
            onClick={() => {
              onPick(option.id);
            }}
            className={`tap-raised flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 font-display text-sm font-semibold ${
              isWrong ? 'border-today text-today opacity-80' : 'bg-card text-ink'
            }`}
          >
            {option.piece && (
              <span className="h-14 w-14 flex-shrink-0">
                <PieceIcon piece={option.piece} />
              </span>
            )}
            {option.textKey && <span className="text-center">{tContent(t, option.textKey)}</span>}
          </button>
        );
      })}
    </div>
  );
}
