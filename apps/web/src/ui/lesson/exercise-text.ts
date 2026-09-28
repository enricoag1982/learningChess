import type { TFunction } from 'i18next';
import type {
  AnyNoteEntry,
  ExerciseDefBase,
  ExerciseFeedbackBase,
  Resolve,
  Stars,
} from '@learn/platform-core';
import { exerciseNote as coreExerciseNote } from '@learn/platform-core';
import { characterName, tContent } from '../../content-text.ts';
import type { SpeechBubbleNote } from '../ds/SpeechBubble.tsx';

/** The exercise's instruction: always shown, never replaced by a hint / error / praise note. */
export function exerciseInstructionText(t: TFunction, def: ExerciseDefBase): string {
  return tContent(t, def.textKey);
}

/** The note under the instruction for the current feedback, or `undefined` while just reading the
 * instruction (teaching-process.md §3.3) — resolves `character` to core `exerciseNote`'s ctx, over
 * the active subject's own note table (`notes`) and extra vars (`vars`, chess: `{ piece }`). `offer`
 * appends the easier-variant sentence on an error note (never on a hint, toggle or undo). */
export function exerciseNote(
  t: TFunction,
  feedback: ExerciseFeedbackBase,
  character: string,
  stars: Stars,
  offer: boolean,
  notes: Readonly<Record<string, AnyNoteEntry>>,
  vars: Readonly<Record<string, string>>,
): SpeechBubbleNote | undefined {
  const ctx = { name: characterName(t, character), stars, vars };
  return coreExerciseNote(t as Resolve, feedback, ctx, notes, offer);
}
