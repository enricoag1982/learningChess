// Platform note dispatch: subject-free — a subject supplies its own feedback kinds and note table
// (`SubjectCore.notes`/`noteVars`) on top of this.
import type { Stars } from './progress.ts';

/** Resolves an i18n key (+ interpolation vars) to text — `TFunction` satisfies this. */
export type Resolve = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

/** What the Owl bubble should say right now; a subject's own feedback type extends this with its
 * own literal `kind`s and fields (the index signature lets a kind's own feedback literal, e.g.
 * `{ kind: 'opponent-reply', reply }`, assign straight into a generically-typed `feedback` slot). */
export interface ExerciseFeedbackBase {
  readonly kind: string;
  readonly [field: string]: unknown;
}

/** Vars every note's `text` may draw on: the platform ones, plus the subject's own
 * (`SubjectCore.noteVars(character)`, chess: `{ piece }`). */
export interface ExerciseNoteCtx {
  readonly name: string;
  readonly stars: Stars;
  readonly vars: Readonly<Record<string, string>>;
}

export interface ExerciseNote {
  readonly text: string;
  readonly tone: 'attention' | 'praise';
}

/** One feedback kind's note: `text` is method syntax (deliberate, same reason as `ExerciseKind`):
 * bivariant parameter checking lets each subject's precise `NoteEntry<F>` widen to `AnyNoteEntry`
 * (`exerciseNote`'s dispatch) with no cast. */
export interface NoteEntry<F extends ExerciseFeedbackBase = ExerciseFeedbackBase> {
  readonly tone: 'attention' | 'praise';
  /** Set on the feedback kinds the easier-variant offer piggybacks on (never a hint, toggle or undo). */
  readonly error?: true;
  text(r: Resolve, feedback: F, ctx: ExerciseNoteCtx): string;
}

export type AnyNoteEntry = NoteEntry;

/** `notes[kind]`, widened to `AnyNoteEntry`. */
function noteEntryOf(
  notes: Readonly<Record<string, AnyNoteEntry>>,
  kind: string,
): AnyNoteEntry | undefined {
  return notes[kind];
}

/** True for the feedback kinds the easier-variant offer piggybacks on (never a hint, toggle or
 * undo) — the one place besides `exerciseNote` itself that needs to know. */
export function isEasierOfferNote(
  notes: Readonly<Record<string, AnyNoteEntry>>,
  kind: string,
): boolean {
  return noteEntryOf(notes, kind)?.error === true;
}

/** The note under the instruction for the current feedback, or `undefined` while just reading the
 * instruction (teaching-process.md §3.3) or for a kind `notes` has no entry for. `offer` appends
 * the easier-variant sentence on an error note (never on a hint, toggle or undo). */
export function exerciseNote(
  r: Resolve,
  feedback: ExerciseFeedbackBase,
  ctx: ExerciseNoteCtx,
  notes: Readonly<Record<string, AnyNoteEntry>>,
  offer: boolean,
): ExerciseNote | undefined {
  if (feedback.kind === 'instruction') {
    return undefined;
  }
  const entry = noteEntryOf(notes, feedback.kind);
  if (!entry) {
    return undefined;
  }
  const text = entry.text(r, feedback, ctx);
  return {
    text: offer && entry.error ? `${text} ${r('exercise.easier-offer')}` : text,
    tone: entry.tone,
  };
}
