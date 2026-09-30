import { describe, expect, it } from 'vitest';
import { AVATARS } from '@learn/platform-core';
import { bot, chessCore } from '@learn/subject-chess';
import { chessWeb } from '@learn/subject-chess/web/chess-pack.ts';
import { ANIMAL_IMAGES } from '@learn/platform-web/ui/art/animal-images.ts';

/** The lesson characters `CharacterIcon` draws from an image: Owl (the narrator, World 1) and Fox (the kid's own avatar,
 * also usable as a `CharacterIcon` — `characters.tsx`). Piece characters are drawn by the pack (`characterArt`). */
const LESSON_CHARACTER_IDS = ['owl', 'fox'];

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

describe('piece characters are drawn by the chess pack, not from an image', () => {
  it.each(Object.keys(chessCore.characters))('character %s is its piece icon', (id) => {
    expect(chessWeb.characterArt(id)).not.toBeNull();
    expect(Object.hasOwn(ANIMAL_IMAGES, id)).toBe(false);
  });

  it('leaves Owl to its image', () => {
    expect(chessWeb.characterArt('owl')).toBeNull();
  });
});
