import type { TFunction } from 'i18next';
import { characterName, tContent } from '../content-text.ts';
import { characterPieceOrNull } from './art/character-meta.ts';

/** First lesson id per character, in curriculum order (world order, then lesson order within it). */
export function firstLessonsByCharacter(
  lessons: readonly {
    readonly id: string;
    readonly character: string;
    readonly world: string;
    readonly order: number;
  }[],
  worldOrder: ReadonlyMap<string, number>,
): Map<string, string> {
  const sorted = [...lessons].sort(
    (a, b) => (worldOrder.get(a.world) ?? 0) - (worldOrder.get(b.world) ?? 0) || a.order - b.order,
  );
  const first = new Map<string, string>();
  for (const lesson of sorted) {
    if (!first.has(lesson.character)) first.set(lesson.character, lesson.id);
  }
  return first;
}

/**
 * The condition text for a locked mini-game: the piece word for the first lesson of a piece
 * character ("Pawn"), else the lesson's title (Owl-taught lessons, and later lessons of the same
 * character such as "Caterpillar Transforms!").
 */
export function unlockLabel(
  t: TFunction,
  lesson: { readonly id: string; readonly character: string; readonly titleKey: string },
  firstLessonOfCharacter: ReadonlyMap<string, string>,
): string {
  const piece = characterPieceOrNull(lesson.character);
  return piece !== null && firstLessonOfCharacter.get(lesson.character) === lesson.id
    ? t(`piece.${piece}`)
    : tContent(t, lesson.titleKey);
}

/**
 * Journey map node label for a lesson: the character's name for the first lesson of that piece
 * character ("Caterpillar"), else the lesson's own title, so a repeated character's later lesson
 * ("Promotion") reads as "Caterpillar Transforms!" instead of a second, indistinguishable
 * "Caterpillar" node (M3.5 polish). Owl-taught lessons (no piece character, World 1) always use
 * their own title, unchanged.
 */
export function journeyNodeLabel(
  t: TFunction,
  lesson: { readonly id: string; readonly character: string; readonly titleKey: string },
  firstLessonOfCharacter: ReadonlyMap<string, string>,
): string {
  const piece = characterPieceOrNull(lesson.character);
  if (piece === null) {
    return tContent(t, lesson.titleKey);
  }
  return firstLessonOfCharacter.get(lesson.character) === lesson.id
    ? characterName(t, lesson.character)
    : tContent(t, lesson.titleKey);
}
