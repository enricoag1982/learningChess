import { describe, expect, it } from 'vitest';
import type { PieceType } from '@chess-kids/core';
import { AVATARS, bot } from '@chess-kids/core';
import { characterForPiece } from './character-meta.ts';
import { ANIMAL_IMAGES } from './animal-images.ts';

const PIECE_TYPES: readonly PieceType[] = ['p', 'r', 'n', 'b', 'q', 'k'];

/** Every lesson-character id real content authors (`packages/content/lessons/**\/*.yaml`,
 * `character:`), plus Owl (the narrator, World 1) and Fox (the kid's own avatar, also usable as a
 * `CharacterIcon` — `characters.tsx`). */
const LESSON_CHARACTER_IDS = [...PIECE_TYPES.map(characterForPiece), 'owl', 'fox'];

/**
 * Every id `CharacterIcon`/`AvatarIcon`/the Play screen's level chips can be given in the real app
 * must resolve to a real, imported image in `ANIMAL_IMAGES` — never fall through to
 * `animalImage`'s defensive fox fallback. Checked directly against
 * `ANIMAL_IMAGES`'s own keys (not via `animalImage()`, which would mask a missing entry behind its
 * own fallback).
 */
describe('ANIMAL_IMAGES covers every real id', () => {
  it.each(LESSON_CHARACTER_IDS)('lesson character %s', (id) => {
    expect(Object.hasOwn(ANIMAL_IMAGES, id)).toBe(true);
  });

  it.each(AVATARS)('profile avatar %s', (id) => {
    expect(Object.hasOwn(ANIMAL_IMAGES, id)).toBe(true);
  });

  it.each(bot.BOT_LEVELS.map((level) => level.name))('bot level %s', (id) => {
    expect(Object.hasOwn(ANIMAL_IMAGES, id)).toBe(true);
  });

  it('has no id mapped to an empty/undefined URL', () => {
    for (const [id, src] of Object.entries(ANIMAL_IMAGES)) {
      expect(src, id).toBeTruthy();
    }
  });
});
