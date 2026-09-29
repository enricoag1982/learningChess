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

export function exerciseInstructionText(t: TFunction, def: ExerciseDefBase): string {
  return tContent(t, def.textKey);
}

/** The note under the instruction for the current feedback, or `undefined` while just reading it (teaching-process.md §3.3);
 * resolves `character` over the subject's note table and vars. `offer` appends the easier-variant sentence on error notes. */
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
