import type { ExerciseDefBase, Lesson as LessonBase, MiniGameBase } from './subject.ts';

// The platform's own base types for lesson/mini-game content: every subject's concrete shapes
// (chess: `domain/chess/lesson.ts`, exported via `./chess`) build on these. Code here only ever
// reads base fields (id, world, order, concept, …) — a concrete value always widens to fit; kept
// generic in `E`/`Demo` (default: base) so a function that only ever passes a whole `Lesson`
// through (`journey.ts`) infers the caller's concrete type back rather than losing it.

/** The generic `Lesson<E, Demo>` (`subject.ts`), at its base defaults. */
export type Lesson<
  E extends ExerciseDefBase = ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
> = LessonBase<E, Demo>;

/** One mini-game's base fields, under the name platform code imports for it. A subject's concrete
 * mini-game shape (chess: `domain/chess/lesson.ts`'s `MiniGame` union) widens to this. */
export type MiniGame = MiniGameBase;

/** Whole compiled content bundle, at its base fields — a subject's concrete bundle (chess:
 * `domain/chess/lesson.ts`'s `CompiledContent`) widens to this. */
export interface CompiledContent {
  readonly version: 1;
  readonly lessons: readonly Lesson[];
  readonly minigames: readonly MiniGame[];
}
