import type { ExerciseDefBase, Lesson as LessonBase, MiniGameBase } from './subject.ts';

// Platform base types for lesson / mini-game content; a subject's concrete shapes widen to them. Generic in
// `E` / `Demo` so pass-through code (`journey.ts`) infers the caller's concrete type.

export type Lesson<
  E extends ExerciseDefBase = ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
> = LessonBase<E, Demo>;

export type MiniGame = MiniGameBase;

export interface CompiledContent {
  readonly version: 1;
  readonly lessons: readonly Lesson[];
  readonly minigames: readonly MiniGame[];
}
