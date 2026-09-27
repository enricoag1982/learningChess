// The Owl bubble's feedback note, as data: one entry per `ExerciseFeedback` kind, driving both the
// live app (`exerciseNote`) and the content build's voice inventory (loops `EXERCISE_NOTES`).
import type { Move } from '../chess/rules.ts';
import type { PieceType } from '../chess/types.ts';
import type { Stars } from '../progress.ts';
import type { Hint } from './hint.ts';

/** Resolves an i18n key (+ interpolation vars) to text — `TFunction` satisfies this. */
export type Resolve = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

/** What the Owl bubble should say right now; resolved to text by `exerciseNote`. */
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

/** Vars every note's `text` may draw on (not every kind uses every field). */
export interface ExerciseNoteCtx {
  readonly name: string;
  readonly piece: PieceType;
  readonly stars: Stars;
}

export interface ExerciseNote {
  readonly text: string;
  readonly tone: 'attention' | 'praise';
}

type NoteFeedback<K extends ExerciseNoteKind> = Extract<ExerciseFeedback, { readonly kind: K }>;

/** One feedback kind's note: `text` is method syntax (deliberate, same reason as `ExerciseKind`):
 * bivariant parameter checking lets each kind's precise `NoteEntry<F>` widen to `AnyNoteEntry`
 * (`exerciseNote`'s dispatch) with no cast. */
export interface NoteEntry<F extends ExerciseFeedback> {
  readonly tone: 'attention' | 'praise';
  /** Set on the feedback kinds the easier-variant offer piggybacks on (never a hint, toggle or undo). */
  readonly error?: true;
  text(r: Resolve, feedback: F, ctx: ExerciseNoteCtx): string;
}

/** Any note entry, widened from its own precise feedback kind. */
export type AnyNoteEntry = NoteEntry<ExerciseFeedback>;

/** The piece-specific "that's not how I move" line (docs/screens.md: errors are never red). */
function illegalMoveText(r: Resolve, piece: PieceType, name: string): string {
  return r(`exercise.illegal.${piece}`, { name });
}

/** Praise line shown once an exercise is solved, picked by stars earned. */
function praiseText(r: Resolve, stars: Stars): string {
  if (stars >= 3) return r('exercise.praise-3');
  if (stars === 2) return r('exercise.praise-2');
  return r('exercise.praise-1');
}

/** Hint-ladder text: shape (and so wording) depends on the exercise type (`hint.kind`). */
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
  if (hint.kind === 'choice') {
    if (hint.level === 3) return r('exercise.hint-answer');
    return r('exercise.hint-remove-option');
  }
  // setup
  if (hint.level === 3 || hint.piece === undefined) return r('exercise.hint-answer');
  if (hint.level === 2 && hint.square !== undefined) return r('exercise.setup.hint-square');
  return r('exercise.setup.hint-piece', {
    color: r(`board.color.${hint.piece.color}`),
    piece: r(`board.piece.${hint.piece.type}`),
  });
}

/** One entry per non-`instruction` `ExerciseFeedback` kind — the content build's voice inventory
 * loops this same table instead of mirroring `exerciseNote`'s logic by hand. */
export const EXERCISE_NOTES = {
  'tap-first': {
    tone: 'attention',
    text: (r, _f, { name }) => r('exercise.tap-piece-first', { name }),
  },
  illegal: {
    tone: 'attention',
    error: true,
    text: (r, _f, { piece, name }) => illegalMoveText(r, piece, name),
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

/** `EXERCISE_NOTES[kind]`, widened to `AnyNoteEntry` — the one narrowing point `exerciseNote`'s
 * dispatch funnels through (mirrors `kindOf`). */
function noteEntryOf(kind: ExerciseNoteKind): AnyNoteEntry {
  return EXERCISE_NOTES[kind];
}

/** True for the feedback kinds the easier-variant offer piggybacks on (never a hint, toggle or
 * undo) — the one place besides `exerciseNote` itself that needs to know, without indexing
 * `EXERCISE_NOTES` by a non-literal kind (whose union type loses the optional `error` field). */
export function isEasierOfferNote(kind: ExerciseNoteKind): boolean {
  return noteEntryOf(kind).error === true;
}

/** The note under the instruction for the current feedback, or `undefined` while just reading the
 * instruction (teaching-process.md §3.3). `offer` appends the easier-variant sentence on an error
 * note (never on a hint, toggle or undo). */
export function exerciseNote(
  r: Resolve,
  feedback: ExerciseFeedback,
  ctx: ExerciseNoteCtx,
  offer: boolean,
): ExerciseNote | undefined {
  if (feedback.kind === 'instruction') {
    return undefined;
  }
  const entry = noteEntryOf(feedback.kind);
  const text = entry.text(r, feedback, ctx);
  return {
    text: offer && entry.error ? `${text} ${r('exercise.easier-offer')}` : text,
    tone: entry.tone,
  };
}
