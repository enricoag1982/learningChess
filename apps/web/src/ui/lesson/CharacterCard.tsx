import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { PieceType } from '@chess-kids/core/chess';
import { characterName } from '../../content-text.ts';
import { characterColor, characterPieceOrNull } from '../art/character-meta.ts';
import { CharacterIcon } from '../art/characters.tsx';
import { PieceIcon } from '../board/pieces.tsx';

function pieceTypeName(t: TFunction, type: PieceType): string {
  switch (type) {
    case 'r':
      return t('piece.r');
    case 'b':
      return t('piece.b');
    case 'q':
      return t('piece.q');
    case 'k':
      return t('piece.k');
    case 'n':
      return t('piece.n');
    case 'p':
      return t('piece.p');
  }
}

/** Character portrait + name, and (except Owl) a piece-icon badge naming the chess piece it
 * stands for. A compact row on phone width, a big portrait over a column from `sm` up. */
export function CharacterCard({ character }: { readonly character: string }): JSX.Element {
  const { t } = useTranslation();
  const piece = characterPieceOrNull(character);

  return (
    <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto sm:flex-col sm:justify-center sm:gap-3">
      <div
        // Capped at 128px: the 256px Fluent Emoji 3D source stays sharp
        // at 2x DPR up to that size, and a bigger slot would just upscale it.
        className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full p-2 sm:h-32 sm:w-32 sm:p-5"
        style={{ backgroundColor: characterColor(character) }}
      >
        <CharacterIcon character={character} />
      </div>
      <span className="font-display text-lg text-ink sm:text-xl md:text-2xl">
        {characterName(t, character)}
      </span>
      {piece !== null && (
        <div className="info-flat ml-auto flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 font-bold text-ink sm:ml-0 sm:px-4 sm:py-2">
          <span className="h-6 w-6 sm:h-7 sm:w-7">
            <PieceIcon piece={{ color: 'w', type: piece }} />
          </span>
          {pieceTypeName(t, piece)}
        </div>
      )}
    </div>
  );
}
