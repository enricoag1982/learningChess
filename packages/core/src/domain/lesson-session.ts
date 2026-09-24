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
