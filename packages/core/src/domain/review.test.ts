import { describe, expect, it } from 'vitest';

import type { Lesson } from './lesson.ts';
import type { ExerciseDef } from './exercise/types.ts';
import { seededRandom } from './random.ts';
import type { ConceptPoolEntry, ConceptStats } from './review.ts';
import {
  accuracy,
  applyReviewResult,
  appendResult,
  conceptPool,
  enterReview,
  isDue,
  isWeak,
  newConceptStats,
  pickPracticeTasks,
  pickWarmUp,
} from './review.ts';

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

function makeExercise(id: string, concept: string): ExerciseDef {
  return {
    id,
    concept,
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
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
    guided: [],
    exercises: [],
    ...overrides,
  };
}

function stats(overrides: Partial<ConceptStats> = {}): ConceptStats {
  return {
    id: 'cs1',
    profileId: 'profile-1',
    conceptId: 'rook-move',
    recent: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2026-02-01T00:00:00.000Z');

describe('newConceptStats', () => {
  it('starts with no recent results and not in review', () => {
    const fresh = newConceptStats('id1', 'profile-1', 'rook-move', NOW);
    expect(fresh.recent).toEqual([]);
    expect(fresh.box).toBeUndefined();
    expect(fresh.dueAt).toBeUndefined();
  });
});

describe('appendResult', () => {
  it('appends newest last and caps at 10', () => {
    let s = stats();
    for (let i = 0; i < 12; i += 1) {
      s = appendResult(s, i % 2 === 0, NOW);
    }
    expect(s.recent).toHaveLength(10);
    // First two pushes (true, false) fall off; the 11th (index 10, even → true) is now oldest.
    expect(s.recent[0]).toBe(true);
    expect(s.recent.at(-1)).toBe(false); // index 11, odd → false
  });
});

describe('accuracy / isWeak', () => {
  it('is 0 with no results', () => {
    expect(accuracy(stats())).toBe(0);
    expect(isWeak(stats())).toBe(false);
  });

  it('computes correct / total', () => {
    const s = stats({ recent: [true, true, false, true] });
    expect(accuracy(s)).toBe(0.75);
  });

  it('is weak only with >= 3 results and accuracy < 60%', () => {
    expect(isWeak(stats({ recent: [false, true] }))).toBe(false); // only 2 results
    expect(isWeak(stats({ recent: [false, false, true] }))).toBe(true); // 1/3
    expect(isWeak(stats({ recent: [true, true, false] }))).toBe(false); // 2/3
  });
});

describe('enterReview', () => {
  it('sets box 1 due in 1 day when not immediate', () => {
    const entered = enterReview(stats(), NOW, false);
    expect(entered.box).toBe(1);
    expect(entered.dueAt).toBe(new Date(NOW.getTime() + 86400000).toISOString());
  });

  it('sets box 1 due now when immediate', () => {
    const entered = enterReview(stats(), NOW, true);
    expect(entered.box).toBe(1);
    expect(entered.dueAt).toBe(NOW.toISOString());
  });

  it('a non-immediate entry never overrides an already-in-review concept (no pushing due dates out)', () => {
    const already = stats({ box: 3, dueAt: '2026-01-05T00:00:00.000Z' });
    const result = enterReview(already, NOW, false);
    expect(result).toBe(already);
  });

  it('an immediate entry always resets box 1 due now, even if already in review', () => {
    const already = stats({ box: 4, dueAt: '2026-03-01T00:00:00.000Z' });
    const result = enterReview(already, NOW, true);
    expect(result.box).toBe(1);
    expect(result.dueAt).toBe(NOW.toISOString());
  });
});

describe('applyReviewResult', () => {
  it('correct moves the box up by 1, rescheduling by the new box interval', () => {
    const s = stats({ box: 2, dueAt: '2026-01-10T00:00:00.000Z' });
    const result = applyReviewResult(s, true, 'rook-01', NOW);
    expect(result.box).toBe(3);
    expect(result.dueAt).toBe(new Date(NOW.getTime() + 4 * 86400000).toISOString());
    expect(result.lastExerciseId).toBe('rook-01');
  });

  it('caps the box at 5', () => {
    const s = stats({ box: 5, dueAt: '2026-01-10T00:00:00.000Z' });
    const result = applyReviewResult(s, true, 'rook-01', NOW);
    expect(result.box).toBe(5);
    expect(result.dueAt).toBe(new Date(NOW.getTime() + 16 * 86400000).toISOString());
  });

  it('wrong resets the box to 1', () => {
    const s = stats({ box: 4, dueAt: '2026-01-10T00:00:00.000Z' });
    const result = applyReviewResult(s, false, 'rook-01', NOW);
    expect(result.box).toBe(1);
    expect(result.dueAt).toBe(new Date(NOW.getTime() + 86400000).toISOString());
  });

  it('treats a missing box as 1 (defensive default)', () => {
    const result = applyReviewResult(stats(), true, 'rook-01', NOW);
    expect(result.box).toBe(2);
  });
});

describe('isDue', () => {
  it('false when not in review', () => {
    expect(isDue(stats(), NOW)).toBe(false);
  });

  it('true once dueAt has passed, false before', () => {
    const due = stats({ box: 1, dueAt: '2026-01-01T00:00:00.000Z' });
    const notYet = stats({ box: 1, dueAt: '2026-03-01T00:00:00.000Z' });
    expect(isDue(due, NOW)).toBe(true);
    expect(isDue(notYet, NOW)).toBe(false);
  });

  it('due exactly now counts as due', () => {
    const dueNow = stats({ box: 1, dueAt: NOW.toISOString() });
    expect(isDue(dueNow, NOW)).toBe(true);
  });
});

describe('conceptPool', () => {
  it('collects scored exercises for a concept across every lesson, with their lesson id', () => {
    const rook = makeLesson({
      id: 'rook',
      exercises: [makeExercise('rook-01', 'rook-move'), makeExercise('rook-02', 'rook-move')],
    });
    const bishop = makeLesson({
      id: 'bishop',
      concept: 'bishop-move',
      exercises: [makeExercise('bishop-01', 'bishop-move')],
    });
    const pool = conceptPool([rook, bishop], 'rook-move');
    expect(pool).toEqual([
      { lessonId: 'rook', exercise: rook.exercises[0] },
      { lessonId: 'rook', exercise: rook.exercises[1] },
    ]);
  });

  it('never includes guided tries', () => {
    const lesson = makeLesson({
      guided: [makeExercise('rook-g1', 'rook-move')],
      exercises: [makeExercise('rook-01', 'rook-move')],
    });
    const pool = conceptPool([lesson], 'rook-move');
    expect(pool.map((entry) => entry.exercise.id)).toEqual(['rook-01']);
  });

  it('is empty for an unknown concept', () => {
    const lesson = makeLesson({ exercises: [makeExercise('rook-01', 'rook-move')] });
    expect(conceptPool([lesson], 'bishop-move')).toEqual([]);
  });
});

const ROOK_POOL: readonly ConceptPoolEntry[] = [
  { lessonId: 'rook', exercise: makeExercise('rook-01', 'rook-move') },
  { lessonId: 'rook', exercise: makeExercise('rook-02', 'rook-move') },
  { lessonId: 'rook', exercise: makeExercise('rook-03', 'rook-move') },
];
const BISHOP_POOL: readonly ConceptPoolEntry[] = [
  { lessonId: 'bishop', exercise: makeExercise('bishop-01', 'bishop-move') },
];
const QUEEN_POOL: readonly ConceptPoolEntry[] = [
  { lessonId: 'queen', exercise: makeExercise('queen-01', 'queen-move') },
];

function poolMap(): ReadonlyMap<string, readonly ConceptPoolEntry[]> {
  return new Map([
    ['rook-move', ROOK_POOL],
    ['bishop-move', BISHOP_POOL],
    ['queen-move', QUEEN_POOL],
  ]);
}

describe('pickWarmUp', () => {
  it('is empty when no concept is in review', () => {
    const result = pickWarmUp([stats()], poolMap(), NOW, seededRandom(1));
    expect(result).toEqual([]);
  });

  it('picks due concepts oldest dueAt first, max 1 task per concept', () => {
    const rook = stats({ conceptId: 'rook-move', box: 2, dueAt: '2026-01-10T00:00:00.000Z' });
    const bishop = stats({ conceptId: 'bishop-move', box: 1, dueAt: '2026-01-05T00:00:00.000Z' });
    const queen = stats({ conceptId: 'queen-move', box: 3, dueAt: '2026-01-08T00:00:00.000Z' });

    const tasks = pickWarmUp([rook, bishop, queen], poolMap(), NOW, seededRandom(1));

    expect(tasks.map((t) => t.conceptId)).toEqual(['bishop-move', 'queen-move', 'rook-move']);
    expect(new Set(tasks.map((t) => t.conceptId)).size).toBe(3);
  });

  it('fills with the weakest concepts in review (lowest accuracy, then oldest dueAt) when fewer than 3 are due', () => {
    const due = stats({
      conceptId: 'rook-move',
      box: 1,
      dueAt: '2026-01-01T00:00:00.000Z',
    });
    const weak = stats({
      conceptId: 'bishop-move',
      box: 2,
      dueAt: '2026-06-01T00:00:00.000Z',
      recent: [false, false, true],
    });
    const strong = stats({
      conceptId: 'queen-move',
      box: 2,
      dueAt: '2026-05-01T00:00:00.000Z',
      recent: [true, true, true],
    });

    const tasks = pickWarmUp([due, weak, strong], poolMap(), NOW, seededRandom(1));

    expect(tasks.map((t) => t.conceptId)).toEqual(['rook-move', 'bishop-move', 'queen-move']);
  });

  it('returns fewer than 3 tasks when review has fewer than 3 concepts', () => {
    const rook = stats({ conceptId: 'rook-move', box: 1, dueAt: '2026-01-01T00:00:00.000Z' });
    const tasks = pickWarmUp([rook], poolMap(), NOW, seededRandom(1));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.conceptId).toBe('rook-move');
  });

  it('avoids the last exercise shown for a concept when the pool has another candidate', () => {
    const rook = stats({
      conceptId: 'rook-move',
      box: 1,
      dueAt: '2026-01-01T00:00:00.000Z',
      lastExerciseId: 'rook-01',
    });
    for (let seed = 0; seed < 20; seed += 1) {
      const tasks = pickWarmUp([rook], poolMap(), NOW, seededRandom(seed));
      expect(tasks[0]?.exercise.id).not.toBe('rook-01');
    }
  });

  it('falls back to the last exercise when it is the only one in the pool', () => {
    const bishop = stats({
      conceptId: 'bishop-move',
      box: 1,
      dueAt: '2026-01-01T00:00:00.000Z',
      lastExerciseId: 'bishop-01',
    });
    const tasks = pickWarmUp([bishop], poolMap(), NOW, seededRandom(1));
    expect(tasks[0]?.exercise.id).toBe('bishop-01');
  });

  it('is deterministic for a fixed seed', () => {
    const rook = stats({ conceptId: 'rook-move', box: 1, dueAt: '2026-01-01T00:00:00.000Z' });
    const a = pickWarmUp([rook], poolMap(), NOW, seededRandom(7));
    const b = pickWarmUp([rook], poolMap(), NOW, seededRandom(7));
    expect(a).toEqual(b);
  });
});

describe('pickPracticeTasks', () => {
  it('returns count tasks for the concept', () => {
    const tasks = pickPracticeTasks('rook-move', ROOK_POOL, undefined, 5, seededRandom(1));
    expect(tasks).toHaveLength(5);
    expect(tasks.every((t) => t.conceptId === 'rook-move')).toBe(true);
  });

  it('cycles through the pool again when count exceeds it', () => {
    const tasks = pickPracticeTasks('bishop-move', BISHOP_POOL, undefined, 3, seededRandom(1));
    expect(tasks).toHaveLength(3);
    expect(tasks.every((t) => t.exercise.id === 'bishop-01')).toBe(true);
  });

  it('is empty for an empty pool', () => {
    expect(pickPracticeTasks('rook-move', [], undefined, 5, seededRandom(1))).toEqual([]);
  });

  it('avoids opening on the last exercise shown when another candidate exists', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const tasks = pickPracticeTasks('rook-move', ROOK_POOL, 'rook-01', 5, seededRandom(seed));
      expect(tasks[0]?.exercise.id).not.toBe('rook-01');
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = pickPracticeTasks('rook-move', ROOK_POOL, 'rook-01', 5, seededRandom(3));
    const b = pickPracticeTasks('rook-move', ROOK_POOL, 'rook-01', 5, seededRandom(3));
    expect(a).toEqual(b);
  });
});
