import type { ExerciseState } from './exercise/engine.ts';
import type { ExerciseDef } from './exercise/types.ts';
import type { Lesson, MiniGame } from './lesson.ts';

/** One screen of a lesson session, in play order. */
export type LessonStep =
  | { readonly kind: 'story' }
  | { readonly kind: 'demo' }
  | { readonly kind: 'guided'; readonly index: number; readonly exercise: ExerciseDef }
  | { readonly kind: 'exercise'; readonly index: number; readonly exercise: ExerciseDef }
  | { readonly kind: 'boss'; readonly game: MiniGame }
  | { readonly kind: 'complete' };

/** UI phase grouping for a step; guided tries and the demo are distinct from scored exercises. */
export type LessonPhase = 'story' | 'demo' | 'try' | 'exercises' | 'boss';

/**
 * Ordered steps for one lesson session: story, demo, guided tries, scored exercises, the boss
 * mini-game (only if `lesson.boss` resolves in `minigames`), then a final `complete` step.
 */
export function lessonSteps(lesson: Lesson, minigames: readonly MiniGame[]): LessonStep[] {
  const guidedSteps: LessonStep[] = lesson.guided.map((exercise, index) => ({
    kind: 'guided',
    index,
    exercise,
  }));
  const exerciseSteps: LessonStep[] = lesson.exercises.map((exercise, index) => ({
    kind: 'exercise',
    index,
    exercise,
  }));
  const boss =
    lesson.boss === undefined ? undefined : minigames.find((game) => game.id === lesson.boss);
  const bossSteps: LessonStep[] = boss === undefined ? [] : [{ kind: 'boss', game: boss }];

  return [
    { kind: 'story' },
    { kind: 'demo' },
    ...guidedSteps,
    ...exerciseSteps,
    ...bossSteps,
    { kind: 'complete' },
  ];
}

/** Errors on one scored exercise after which its easier variant is offered (teaching-process.md §3.3). */
export const EASIER_AFTER_ERRORS = 2;

/** Stars an exercise is credited when the kid solves its easier variant instead (the "completed" tier). */
export const EASIER_VARIANT_STARS = 1;

/** `exercise`'s easier variant from `lesson.variants`, if it names one that exists. */
export function easierVariant(lesson: Lesson, exercise: ExerciseDef): ExerciseDef | undefined {
  if (exercise.easier === undefined) {
    return undefined;
  }
  return lesson.variants?.find((variant) => variant.id === exercise.easier);
}

/** True once an unsolved exercise has `EASIER_AFTER_ERRORS` or more errors. */
export function shouldOfferEasier(state: ExerciseState): boolean {
  return !state.solved && state.errors >= EASIER_AFTER_ERRORS;
}

/** UI phase for a step; `null` for `complete` (no lesson chrome left to show). */
export function stepPhase(step: LessonStep): LessonPhase | null {
  switch (step.kind) {
    case 'story':
      return 'story';
    case 'demo':
      return 'demo';
    case 'guided':
      return 'try';
    case 'exercise':
      return 'exercises';
    case 'boss':
      return 'boss';
    case 'complete':
      return null;
  }
}
