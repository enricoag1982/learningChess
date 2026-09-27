import type { TFunction } from 'i18next';
import type { ExerciseDef, ExerciseFeedback, Resolve, Stars } from '@chess-kids/core';
import { exerciseNote as coreExerciseNote } from '@chess-kids/core';
import { characterName, tContent } from '../../content-text.ts';
import { characterPiece } from '../art/character-meta.ts';
import type { SpeechBubbleNote } from '../ds/SpeechBubble.tsx';

/** The exercise's instruction: always shown, never replaced by a hint / error / praise note. */
export function exerciseInstructionText(t: TFunction, def: ExerciseDef): string {
  return tContent(t, def.textKey);
}

/** The note under the instruction for the current feedback, or `undefined` while just reading the
 * instruction (teaching-process.md §3.3) — resolves `character` to core `exerciseNote`'s ctx.
 * `offer` appends the easier-variant sentence on an error note (never on a hint, toggle or undo). */
export function exerciseNote(
  t: TFunction,
  feedback: ExerciseFeedback,
  character: string,
  stars: Stars,
  offer: boolean,
): SpeechBubbleNote | undefined {
  const ctx = { name: characterName(t, character), piece: characterPiece(character), stars };
  return coreExerciseNote(t as Resolve, feedback, ctx, offer);
}
