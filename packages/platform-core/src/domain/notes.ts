// Platform note dispatch: subject-free — a subject supplies its own feedback kinds and note table
// (`SubjectCore.notes`/`noteVars`) on top of this.
import type { Stars } from './progress.ts';

export type Resolve = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

/** What the Owl bubble says now; a subject's feedback type extends it with its own `kind`s (the index signature lets
 * a kind's literal, e.g. `{ kind: 'opponent-reply', reply }`, assign into a generic `feedback` slot). */
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

/** One feedback kind's note. `text` is method syntax (deliberate): bivariance lets a subject's precise `NoteEntry<F>`
 * widen to `AnyNoteEntry` with no cast. */
export interface NoteEntry<F extends ExerciseFeedbackBase = ExerciseFeedbackBase> {
  readonly tone: 'attention' | 'praise';
  /** Set on the feedback kinds the easier-variant offer piggybacks on (never a hint, toggle or undo). */
  readonly error?: true;
  text(r: Resolve, feedback: F, ctx: ExerciseNoteCtx): string;
}

export type AnyNoteEntry = NoteEntry;

function noteEntryOf(
  notes: Readonly<Record<string, AnyNoteEntry>>,
  kind: string,
): AnyNoteEntry | undefined {
  return notes[kind];
}

export function isEasierOfferNote(
  notes: Readonly<Record<string, AnyNoteEntry>>,
  kind: string,
): boolean {
  return noteEntryOf(notes, kind)?.error === true;
}

/** The note under the instruction for the current feedback; `undefined` while just reading it (teaching-process.md
 * §3.3) or for a kind without an entry. `offer` appends the easier-variant sentence to error notes. */
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
