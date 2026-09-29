import { describe, expect, it } from 'vitest';

import {
  makeExercise as buildExercise,
  makeLesson as buildLesson,
  makeMiniGame as buildMiniGame,
} from '@learn/platform-core/testing';
import {
  easierVariant,
  isSkippablePhase,
  lessonSteps,
  phaseEndIndex,
  shouldOfferEasier,
  stepPhase,
} from '@learn/platform-core/domain/lesson-session';

function makeExercise(id: string) {
  return buildExercise({ id });
}

function makeMiniGame(id: string) {
  return buildMiniGame({
    id,
    par: 2,
    titleKey: `lessons:${id}.title`,
    goalKey: `lessons:${id}.goal`,
  });
}

function makeLesson(overrides: Partial<ReturnType<typeof buildLesson>> = {}) {
  return buildLesson({
    guided: [makeExercise('rook-g1'), makeExercise('rook-g2')],
    exercises: [makeExercise('rook-01'), makeExercise('rook-02'), makeExercise('rook-03')],
    boss: 'hungry-rook',
    ...overrides,
  });
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

describe('isSkippablePhase', () => {
  it('is true for story, demo, try', () => {
    expect(isSkippablePhase('story')).toBe(true);
    expect(isSkippablePhase('demo')).toBe(true);
    expect(isSkippablePhase('try')).toBe(true);
  });

  it('is false for exercises, boss, and null (complete)', () => {
    expect(isSkippablePhase('exercises')).toBe(false);
    expect(isSkippablePhase('boss')).toBe(false);
    expect(isSkippablePhase(null)).toBe(false);
  });
});

describe('phaseEndIndex', () => {
  it('Story (one step): lands on the next step (Demo)', () => {
    const steps = lessonSteps(makeLesson(), [makeMiniGame('hungry-rook')]);
    expect(phaseEndIndex(steps, 0)).toBe(1);
  });

  it('Try (several guided steps): lands past every remaining one, at the first exercise', () => {
    const steps = lessonSteps(makeLesson(), [makeMiniGame('hungry-rook')]);
    // steps: story(0) demo(1) guided(2) guided(3) exercise(4) exercise(5) exercise(6) boss(7) complete(8)
    expect(phaseEndIndex(steps, 2)).toBe(4);
    expect(phaseEndIndex(steps, 3)).toBe(4); // from the last guided step too
  });

  it('never runs past the end: from the boss step, lands on complete', () => {
    const steps = lessonSteps(makeLesson(), [makeMiniGame('hungry-rook')]);
    expect(phaseEndIndex(steps, 7)).toBe(8);
  });
});

function exerciseState(
  def: ReturnType<typeof buildExercise>,
  overrides: Partial<Parameters<typeof shouldOfferEasier>[0]> = {},
): Parameters<typeof shouldOfferEasier>[0] {
  return {
    def,
    moves: 0,
    errors: 0,
    hintLevel: 0,
    solved: false,
    ...overrides,
  };
}

describe('easierVariant', () => {
  it('returns the named variant when the exercise has one and it exists in lesson.variants', () => {
    const variant = makeExercise('rook-04-easy');
    const exercise = { ...makeExercise('rook-04'), easier: 'rook-04-easy' };
    const lesson = makeLesson({ exercises: [exercise], variants: [variant] });

    expect(easierVariant(lesson, exercise)).toBe(variant);
  });

  it('returns undefined when the exercise has no easier', () => {
    const exercise = makeExercise('rook-04');
    const lesson = makeLesson({ exercises: [exercise], variants: [makeExercise('rook-04-easy')] });

    expect(easierVariant(lesson, exercise)).toBeUndefined();
  });

  it('returns undefined when easier names an id missing from lesson.variants', () => {
    const exercise = { ...makeExercise('rook-04'), easier: 'no-such-variant' };
    const lesson = makeLesson({ exercises: [exercise], variants: [makeExercise('rook-04-easy')] });

    expect(easierVariant(lesson, exercise)).toBeUndefined();
  });

  it('returns undefined when the lesson has no variants at all', () => {
    const exercise = { ...makeExercise('rook-04'), easier: 'rook-04-easy' };
    const lesson = makeLesson({ exercises: [exercise] });

    expect(easierVariant(lesson, exercise)).toBeUndefined();
  });
});

describe('shouldOfferEasier', () => {
  const def = makeExercise('rook-04');

  it('is false at 0 or 1 errors', () => {
    expect(shouldOfferEasier(exerciseState(def, { errors: 0 }))).toBe(false);
    expect(shouldOfferEasier(exerciseState(def, { errors: 1 }))).toBe(false);
  });

  it('is true at 2 or more errors while unsolved', () => {
    expect(shouldOfferEasier(exerciseState(def, { errors: 2 }))).toBe(true);
    expect(shouldOfferEasier(exerciseState(def, { errors: 3 }))).toBe(true);
  });

  it('is false once solved, even with 2 or more errors', () => {
    expect(shouldOfferEasier(exerciseState(def, { errors: 2, solved: true }))).toBe(false);
  });
});
