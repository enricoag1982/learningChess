import { describe, expect, it } from 'vitest';

import {
  newAssessmentResult,
  newUnlock,
  planPlacement,
  planTestOutLesson,
  planTestOutWorld,
  scorePlacementWorld,
  scoreTestOut,
} from './assessment.ts';
import type { TracksCatalog, Track, World } from './journey.ts';
import type { Lesson } from './lesson.ts';
import { seededRandom } from './random.ts';
import type { ExerciseDef } from './exercise/types.ts';

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
    concept: `${id}-concept`,
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

function makeLesson(id: string, world: string, order: number, exerciseCount: number): Lesson {
  return {
    id,
    world,
    order,
    concept: `${id}-concept`,
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: Array.from({ length: exerciseCount }, (_, index) =>
      makeExercise(`${id}-${String(index + 1)}`),
    ),
  };
}

const W1: World = { id: 'w1', track: 'basics', order: 1, habitat: 'meadow', titleKey: 'w1' };
const W2: World = { id: 'w2', track: 'basics', order: 2, habitat: 'savannah', titleKey: 'w2' };
const BASICS: Track = { id: 'basics', kind: 'main', titleKey: 'basics', worlds: [W2, W1] };
const OPENINGS: Track = { id: 'openings', kind: 'branch', titleKey: 'openings', worlds: [] };
const CATALOG: TracksCatalog = { tracks: [BASICS, OPENINGS], ranks: [] };

describe('planTestOutLesson', () => {
  it('caps at TEST_OUT_LESSON_TASKS (5), all from the lesson itself', () => {
    const lesson = makeLesson('rook', 'w1', 1, 8);
    const tasks = planTestOutLesson(lesson, seededRandom(1));
    expect(tasks).toHaveLength(5);
    expect(new Set(tasks.map((task) => task.lessonId))).toEqual(new Set(['rook']));
    // No repeats.
    expect(new Set(tasks.map((task) => task.exercise.id)).size).toBe(5);
  });

  it('uses every exercise when the lesson has fewer than 5', () => {
    const lesson = makeLesson('bishop', 'w1', 2, 3);
    const tasks = planTestOutLesson(lesson, seededRandom(1));
    expect(tasks).toHaveLength(3);
  });

  it('is deterministic for a given seed', () => {
    const lesson = makeLesson('rook', 'w1', 1, 8);
    const a = planTestOutLesson(lesson, seededRandom(42));
    const b = planTestOutLesson(lesson, seededRandom(42));
    expect(a.map((t) => t.exercise.id)).toEqual(b.map((t) => t.exercise.id));
  });
});

describe('planTestOutWorld', () => {
  it('spreads TEST_OUT_WORLD_TASKS (8) tasks over every lesson, >=1 each', () => {
    const lessons = [
      makeLesson('l1', 'w1', 1, 2),
      makeLesson('l2', 'w1', 2, 2),
      makeLesson('l3', 'w1', 3, 6),
    ];
    const tasks = planTestOutWorld(W1, lessons, seededRandom(7));
    expect(tasks).toHaveLength(8);
    const byLesson = new Map<string, number>();
    for (const task of tasks) {
      byLesson.set(task.lessonId, (byLesson.get(task.lessonId) ?? 0) + 1);
    }
    expect(byLesson.get('l1')).toBeGreaterThanOrEqual(1);
    expect(byLesson.get('l2')).toBeGreaterThanOrEqual(1);
    expect(byLesson.get('l3')).toBeGreaterThanOrEqual(1);
    // Never more tasks from a lesson than it has exercises.
    expect(byLesson.get('l1')).toBeLessThanOrEqual(2);
    expect(byLesson.get('l2')).toBeLessThanOrEqual(2);
  });

  it('never asks a lesson for more tasks than it has exercises', () => {
    const lessons = [makeLesson('l1', 'w1', 1, 1), makeLesson('l2', 'w1', 2, 1)];
    const tasks = planTestOutWorld(W1, lessons, seededRandom(3));
    // Pool only has 2 exercises total; quota logic must not crash or duplicate.
    expect(tasks.length).toBeLessThanOrEqual(2);
  });

  it('is empty for a world with no authored lessons', () => {
    expect(planTestOutWorld(W1, [], seededRandom(1))).toEqual([]);
  });
});

describe('planPlacement', () => {
  it('plans one run per Basics world, in order, up to 4 tasks each', () => {
    const lessons = [makeLesson('l1', 'w1', 1, 5), makeLesson('l2', 'w2', 1, 5)];
    const plans = planPlacement(CATALOG, lessons, seededRandom(1));
    expect(plans.map((plan) => plan.world.id)).toEqual(['w1', 'w2']);
    for (const plan of plans) {
      expect(plan.tasks).toHaveLength(4);
    }
  });

  it('skips a Basics world with no authored lessons', () => {
    const lessons = [makeLesson('l1', 'w1', 1, 5)];
    const plans = planPlacement(CATALOG, lessons, seededRandom(1));
    expect(plans.map((plan) => plan.world.id)).toEqual(['w1']);
  });

  it('is empty without a main track', () => {
    const noMain: TracksCatalog = { tracks: [OPENINGS], ranks: [] };
    expect(planPlacement(noMain, [], seededRandom(1))).toEqual([]);
  });
});

describe('scoreTestOut', () => {
  it('passes at exactly the rounded-up 80% mark (lesson: 4/5)', () => {
    expect(scoreTestOut([true, true, true, true, false])).toEqual({
      correct: 4,
      total: 5,
      passed: true,
    });
    expect(scoreTestOut([true, true, true, false, false])).toEqual({
      correct: 3,
      total: 5,
      passed: false,
    });
  });

  it('passes at the rounded-up 80% mark for a world run (7/8)', () => {
    const seven = [true, true, true, true, true, true, true, false];
    const six = [true, true, true, true, true, true, false, false];
    expect(scoreTestOut(seven).passed).toBe(true);
    expect(scoreTestOut(six).passed).toBe(false);
  });

  it('never passes with zero tasks', () => {
    expect(scoreTestOut([]).passed).toBe(false);
  });
});

describe('scorePlacementWorld', () => {
  it('passes at >= 3/4 (75%)', () => {
    expect(scorePlacementWorld([true, true, true, false]).passed).toBe(true);
    expect(scorePlacementWorld([true, true, false, false]).passed).toBe(false);
  });
});

describe('newAssessmentResult / newUnlock', () => {
  const NOW = new Date('2026-01-01T00:00:00.000Z');

  it('builds a stored AssessmentResult from a score', () => {
    const score = scoreTestOut([true, true, true, true, false]);
    const result = newAssessmentResult(
      'id-1',
      'profile-1',
      'test-out',
      { type: 'lesson', lessonId: 'rook', worldId: 'w1' },
      score,
      NOW,
    );
    expect(result).toMatchObject({
      id: 'id-1',
      profileId: 'profile-1',
      kind: 'test-out',
      correct: 4,
      total: 5,
      passed: true,
      at: NOW.toISOString(),
    });
  });

  it('builds a stored Unlock row', () => {
    const unlock = newUnlock('id-2', 'profile-1', 'world', 'w1', 'test-out', NOW);
    expect(unlock).toMatchObject({
      id: 'id-2',
      profileId: 'profile-1',
      targetType: 'world',
      targetId: 'w1',
      via: 'test-out',
    });
  });
});
