import { describe, expect, it } from 'vitest';

import type { ExerciseDef } from './exercise/types.ts';
import type { StaticCaptureGameDef } from './exercise/minigame.ts';
import type { Lesson, MiniGame } from './lesson.ts';
import { lessonSteps, stepPhase } from './lesson-session.ts';

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

function makeExercise(id: string): ExerciseDef {
  return {
    id,
    concept: 'rook-move',
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

function makeGameDef(id: string): StaticCaptureGameDef {
  return { id, concept: 'rook-move', position: EMPTY_POSITION, par: 2 };
}

function makeMiniGame(id: string): MiniGame {
  return {
    ...makeGameDef(id),
    mode: 'static',
    titleKey: `lessons:${id}.title`,
    goalKey: `lessons:${id}.goal`,
    unlockAfter: 'rook',
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'rook',
    world: 'pieces',
    order: 1,
    concept: 'rook-move',
    character: 'rhino',
    titleKey: 'lessons:rook.title',
    storyKey: 'lessons:rook.story',
    demo: {
      position: EMPTY_POSITION,
      textKey: 'lessons:rook.demo',
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [makeExercise('rook-g1'), makeExercise('rook-g2')],
    exercises: [makeExercise('rook-01'), makeExercise('rook-02'), makeExercise('rook-03')],
    boss: 'hungry-rook',
    ...overrides,
  };
}

describe('lessonSteps', () => {
  it('orders story, demo, guided, exercises, boss, complete; indexes each own list from 0', () => {
    const lesson = makeLesson();
    const minigames = [makeMiniGame('hungry-rook')];

    const steps = lessonSteps(lesson, minigames);

    expect(steps.map((step) => step.kind)).toEqual([
      'story',
      'demo',
      'guided',
      'guided',
      'exercise',
      'exercise',
      'exercise',
      'boss',
      'complete',
    ]);
    expect(steps.map((step) => stepPhase(step))).toEqual([
      'story',
      'demo',
      'try',
      'try',
      'exercises',
      'exercises',
      'exercises',
      'boss',
      null,
    ]);

    const guidedSteps = steps.filter((step) => step.kind === 'guided');
    expect(guidedSteps.map((step) => step.index)).toEqual([0, 1]);
    expect(guidedSteps.map((step) => step.exercise.id)).toEqual(['rook-g1', 'rook-g2']);

    const exerciseSteps = steps.filter((step) => step.kind === 'exercise');
    expect(exerciseSteps.map((step) => step.index)).toEqual([0, 1, 2]);

    const bossStep = steps.find((step) => step.kind === 'boss');
    expect(bossStep).toBeDefined();
    expect(bossStep?.kind === 'boss' ? bossStep.game.id : undefined).toBe('hungry-rook');
  });

  it('omits the boss step when the lesson has no boss', () => {
    const lesson = makeLesson({ boss: undefined });
    const steps = lessonSteps(lesson, [makeMiniGame('hungry-rook')]);
    expect(steps.some((step) => step.kind === 'boss')).toBe(false);
    expect(steps.at(-1)).toEqual({ kind: 'complete' });
  });

  it('omits the boss step when the referenced mini-game is not found in content', () => {
    const lesson = makeLesson({ boss: 'missing-game' });
    const steps = lessonSteps(lesson, [makeMiniGame('hungry-rook')]);
    expect(steps.some((step) => step.kind === 'boss')).toBe(false);
  });

  it('has no guided or exercise steps for an empty lesson', () => {
    const lesson = makeLesson({ boss: undefined, guided: [], exercises: [] });
    const steps = lessonSteps(lesson, []);
    expect(steps.map((step) => step.kind)).toEqual(['story', 'demo', 'complete']);
  });
});
