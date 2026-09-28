import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { usePack } from '../../app/subject.ts';
import { characterName } from '@learn/platform-web/content-text.ts';
import { characterColor } from '@learn/platform-web/ui/art/animal-images.ts';
import { CharacterIcon } from '../art/characters.tsx';

/** Character portrait + name, and (except Owl) a subject-supplied badge (chess: a piece-icon
 * badge naming the chess piece it stands for). A compact row on phone width, a big portrait over
 * a column from `sm` up. */
export function CharacterCard({ character }: { readonly character: string }): JSX.Element {
  const { t } = useTranslation();
  const pack = usePack();

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
      {pack.CharacterBadge && <pack.CharacterBadge character={character} />}
    </div>
  );
}
