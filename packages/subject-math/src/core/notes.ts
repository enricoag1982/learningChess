// The Owl bubble's feedback note as data: one entry per `MathFeedback` kind, read by the platform's `exerciseNote`.
import { choiceHintText, praiseText } from '@learn/platform-core/domain/note-text';
import type { NoteEntry, Resolve } from '@learn/platform-core/domain/notes';
import type { MathHint, NumberEntryHint } from './types.ts';

export type MathFeedback =
  | { readonly kind: 'instruction' }
  /** choice / number-entry: a wrong answer. */
  | { readonly kind: 'wrong-answer' }
  | { readonly kind: 'hint'; readonly hint: MathHint }
  | { readonly kind: 'solved' };

export type MathNoteKind = Exclude<MathFeedback['kind'], 'instruction'>;

type NoteFeedback<K extends MathNoteKind> = Extract<MathFeedback, { readonly kind: K }>;

function numberEntryHintText(r: Resolve, hint: NumberEntryHint): string {
  if (hint.level === 3) return r('exercise.hint-answer');
  if (hint.level === 1) return r('math.hint-dots');
  if (hint.problem === undefined) return r('exercise.hint-look');
  const { a, op, b } = hint.problem;
  return r(op === '+' ? 'math.hint-count-on' : 'math.hint-count-back', { a, b });
}

function hintNoteText(r: Resolve, hint: MathHint): string {
  return hint.kind === 'choice' ? choiceHintText(r, hint) : numberEntryHintText(r, hint);
}

export const MATH_NOTES = {
  'wrong-answer': { tone: 'attention', error: true, text: (r) => r('exercise.answer-wrong') },
  hint: { tone: 'attention', text: (r, f) => hintNoteText(r, f.hint) },
  solved: { tone: 'praise', text: (r, _f, { stars }) => praiseText(r, stars) },
} as const satisfies { readonly [K in MathNoteKind]: NoteEntry<NoteFeedback<K>> };
