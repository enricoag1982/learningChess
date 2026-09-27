import type { TFunction } from 'i18next';
import type { ExerciseDef, ExerciseFeedback, Resolve, Stars } from '@chess-kids/core';
import { exerciseNote as coreExerciseNote, isEasierOfferNote } from '@chess-kids/core';
import { characterName, tContent } from '../../content-text.ts';
import { characterPiece } from '../art/character-meta.ts';
import type { SpeechBubbleNote } from '../ds/SpeechBubble.tsx';

/** The exercise's instruction: always shown, never replaced by a hint / error / praise note. */
export function exerciseInstructionText(t: TFunction, def: ExerciseDef): string {
  return tContent(t, def.textKey);
}

/** The note under the instruction for the current feedback, or `undefined` while just reading the
 * instruction (teaching-process.md §3.3) — resolves `character` to core `exerciseNote`'s ctx. */
export function exerciseNote(
  t: TFunction,
  feedback: ExerciseFeedback,
  character: string,
  stars: Stars,
): SpeechBubbleNote | undefined {
  const ctx = { name: characterName(t, character), piece: characterPiece(character), stars };
  return coreExerciseNote(t as Resolve, feedback, ctx, false);
}

/** Appends the "want an easier one?" sentence to `note`'s text when `feedback` is an error feedback
 * kind (never on a hint, toggle or undo); `note` unchanged otherwise. */
export function withEasierOffer(
  t: TFunction,
  note: SpeechBubbleNote | undefined,
  feedback: ExerciseFeedback,
): SpeechBubbleNote | undefined {
  if (note === undefined || feedback.kind === 'instruction' || !isEasierOfferNote(feedback.kind)) {
    return note;
  }
  return { ...note, text: `${note.text} ${t('exercise.easier-offer')}` };
}
