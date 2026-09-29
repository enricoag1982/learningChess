// The Owl bubble's feedback note as data: one entry per `ExerciseFeedback` kind, driving the live app (`exerciseNote`) and the
// content build's voice inventory. Chess-bound: platform note dispatch (`domain/notes.ts`) is subject-free.
import type { Move } from '../chess/rules.ts';
import type {
  AnyNoteEntry,
  ExerciseNote,
  ExerciseNoteCtx,
  NoteEntry,
  Resolve,
} from '@learn/platform-core/domain/notes';
import {
  exerciseNote as platformExerciseNote,
  isEasierOfferNote as platformIsEasierOfferNote,
} from '@learn/platform-core/domain/notes';
import { choiceHintText, praiseText } from '@learn/platform-core/domain/note-text';
import type { Hint } from './hint.ts';

export type { AnyNoteEntry, ExerciseNote, ExerciseNoteCtx, Resolve };

export type ExerciseFeedback =
  | { readonly kind: 'instruction' }
  | { readonly kind: 'tap-first' }
  | { readonly kind: 'illegal' }
  /** select-squares: only wrong picks. */
  | { readonly kind: 'select-wrong' }
  /** select-squares: only missing squares. */
  | { readonly kind: 'select-missing' }
  /** select-squares: wrong picks and missing squares. */
  | { readonly kind: 'select-both' }
  /** yes-no / choice: a wrong pick. */
  | { readonly kind: 'wrong-answer' }
  /** best-move: a legal move that is not in `solutions`. */
  | { readonly kind: 'wrong-move' }
  /** setup: a piece placed on the wrong square (or an already-filled one). */
  | { readonly kind: 'wrong-placement' }
  | { readonly kind: 'hint'; readonly hint: Hint }
  | { readonly kind: 'solved' }
  /** mate-in-n: delivered checkmate (any mating move, not only the scripted one). */
  | { readonly kind: 'checkmate' }
  /** mate-in-n: the scripted opponent reply, revealed after its short delay. */
  | { readonly kind: 'opponent-reply'; readonly reply: Move };

export type ExerciseNoteKind = Exclude<ExerciseFeedback['kind'], 'instruction'>;

type NoteFeedback<K extends ExerciseNoteKind> = Extract<ExerciseFeedback, { readonly kind: K }>;

function illegalMoveText(r: Resolve, piece: string, name: string): string {
  return r(`exercise.illegal.${piece}`, { name });
}

function hintNoteText(r: Resolve, hint: Hint, name: string): string {
  if (hint.kind === 'squares') {
    if (hint.level === 1) return r('exercise.hint-piece', { name });
    if (hint.level === 2) return r('exercise.hint-target');
    return r('exercise.hint-answer');
  }
  if (hint.kind === 'yes-no') {
    if (hint.level === 1) return r('exercise.hint-look');
    if (hint.level === 2) return r('exercise.hint-think-again');
    return r('exercise.hint-answer');
  }
  if (hint.kind === 'choice') return choiceHintText(r, hint);
  // setup
  if (hint.level === 3 || hint.piece === undefined) return r('exercise.hint-answer');
  if (hint.level === 2 && hint.square !== undefined) return r('exercise.setup.hint-square');
  return r('exercise.setup.hint-piece', {
    color: r(`board.color.${hint.piece.color}`),
    piece: r(`board.piece.${hint.piece.type}`),
  });
}

/** One entry per non-`instruction` `ExerciseFeedback` kind; the content build's voice inventory loops this table instead of
 * mirroring `exerciseNote` by hand. Covers chess's kinds and the platform-shaped ones (tap-first, wrong-answer, hint, solved). */
export const EXERCISE_NOTES = {
  'tap-first': {
    tone: 'attention',
    text: (r, _f, { name }) => r('exercise.tap-piece-first', { name }),
  },
  illegal: {
    tone: 'attention',
    error: true,
    text: (r, _f, { vars, name }) => illegalMoveText(r, vars.piece ?? 'r', name),
  },
  'select-wrong': { tone: 'attention', error: true, text: (r) => r('exercise.select-wrong') },
  'select-missing': { tone: 'attention', error: true, text: (r) => r('exercise.select-missing') },
  'select-both': { tone: 'attention', error: true, text: (r) => r('exercise.select-both') },
  'wrong-answer': { tone: 'attention', error: true, text: (r) => r('exercise.answer-wrong') },
  'wrong-move': { tone: 'attention', error: true, text: (r) => r('exercise.move-wrong') },
  'wrong-placement': { tone: 'attention', error: true, text: (r) => r('exercise.setup.wrong') },
  hint: { tone: 'attention', text: (r, f, { name }) => hintNoteText(r, f.hint, name) },
  solved: { tone: 'praise', text: (r, _f, { stars }) => praiseText(r, stars) },
  checkmate: {
    tone: 'praise',
    text: (r, _f, { stars }) => `${r('exercise.checkmate')} ${praiseText(r, stars)}`,
  },
  'opponent-reply': {
    tone: 'attention',
    text: (r, f) =>
      r('exercise.opponent-moved', {
        color: r(`exercise.opponent-color.${f.reply.color}`),
        piece: r(`board.piece.${f.reply.piece}`),
      }),
  },
} as const satisfies { readonly [K in ExerciseNoteKind]: NoteEntry<NoteFeedback<K>> };

/** True for the feedback kinds the easier-variant offer piggybacks on (never a hint, toggle or undo); avoids indexing
 * `EXERCISE_NOTES` by a non-literal kind, whose union loses the optional `error` field. */
export function isEasierOfferNote(kind: ExerciseNoteKind): boolean {
  return platformIsEasierOfferNote(EXERCISE_NOTES, kind);
}

/** The note under the instruction for the current feedback (teaching-process.md §3.3); `offer` appends the easier-variant sentence on error notes. */
export function exerciseNote(
  r: Resolve,
  feedback: ExerciseFeedback,
  ctx: ExerciseNoteCtx,
  offer: boolean,
): ExerciseNote | undefined {
  return platformExerciseNote(r, feedback, ctx, EXERCISE_NOTES, offer);
}
