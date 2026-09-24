import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { PieceType } from '@chess-kids/core';
import { characterName } from '../../content-text.ts';
import { characterColor, characterPiece } from '../art/character-meta.ts';
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

/** Big character portrait + name, and a piece-icon badge naming the chess piece it stands for. */
export function CharacterCard({ character }: { readonly character: string }): JSX.Element {
  const { t } = useTranslation();
  const piece = characterPiece(character);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="h-32 w-32 overflow-hidden rounded-full p-5 sm:h-44 sm:w-44"
        style={{ backgroundColor: characterColor(character) }}
      >
        <CharacterIcon character={character} />
      </div>
      <span className="font-display text-xl text-ink sm:text-2xl">
        {characterName(t, character)}
      </span>
      <div className="flex items-center gap-2 rounded-full border-2 border-line bg-card px-4 py-2 font-bold text-ink">
        <span className="h-7 w-7">
          <PieceIcon piece={{ color: 'w', type: piece }} />
        </span>
        {pieceTypeName(t, piece)}
      </div>
    </div>
  );
}
