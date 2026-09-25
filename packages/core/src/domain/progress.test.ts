import { describe, expect, it } from 'vitest';

import type { ExerciseDef } from './exercise/types.ts';
import type { Lesson } from './lesson.ts';
import type { LessonProgress } from './progress.ts';
import {
  lessonStars,
  lessonStatus,
  newLessonProgress,
  recordBossStars,
  recordExerciseStars,
  recordMiniGamePlay,
  totalStars,
  withoutSkippedPhase,
  withResumeStep,
  withSkippedPhase,
} from './progress.ts';

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
    exercises: [makeExercise('rook-01'), makeExercise('rook-02'), makeExercise('rook-03')],
    ...overrides,
  };
}

const NOW = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-01-02T00:00:00.000Z');

function makeProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    ...newLessonProgress('p1', 'profile-1', 'rook', NOW),
    ...overrides,
  };
}

describe('recordExerciseStars', () => {
  it('keeps the previous best when the new score is lower', () => {
    const lesson = makeLesson();
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 3, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-01', 1, lesson, LATER);
    expect(progress.bestStars['rook-01']).toBe(3);
  });

  it('raises the best when the new score is higher', () => {
    const lesson = makeLesson();
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 1, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-01', 3, lesson, LATER);
    expect(progress.bestStars['rook-01']).toBe(3);
  });

  it('sets completedAt the first time every exercise reaches ≥ 1 star, and never again', () => {
    const lesson = makeLesson();
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 1, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-02', 1, lesson, NOW);
    expect(progress.completedAt).toBeUndefined();

    progress = recordExerciseStars(progress, 'rook-03', 2, lesson, LATER);
    expect(progress.completedAt).toBe(LATER.toISOString());

    const evenLater = new Date('2026-01-03T00:00:00.000Z');
    progress = recordExerciseStars(progress, 'rook-03', 3, lesson, evenLater);
    expect(progress.completedAt).toBe(LATER.toISOString());
  });
});

describe('recordBossStars', () => {
  it('keeps the max across calls', () => {
    let progress = makeProgress();
    progress = recordBossStars(progress, 3, NOW);
    progress = recordBossStars(progress, 1, LATER);
    expect(progress.bossStars).toBe(3);
  });
});

describe('withResumeStep', () => {
  it('sets resumeStep and bumps updatedAt', () => {
    const progress = withResumeStep(makeProgress(), 4, LATER);
    expect(progress.resumeStep).toBe(4);
    expect(progress.updatedAt).toBe(LATER.toISOString());
  });
});

describe('withSkippedPhase', () => {
  it('adds a phase to an empty/absent skippedPhases', () => {
    const progress = withSkippedPhase(makeProgress(), 'story', LATER);
    expect(progress.skippedPhases).toEqual(['story']);
    expect(progress.updatedAt).toBe(LATER.toISOString());
  });

  it('adds a second, different phase alongside the first', () => {
    let progress = withSkippedPhase(makeProgress(), 'story', NOW);
    progress = withSkippedPhase(progress, 'demo', LATER);
    expect(progress.skippedPhases).toEqual(['story', 'demo']);
  });

  it('is a no-op (same object) when the phase is already marked', () => {
    const once = withSkippedPhase(makeProgress(), 'try', NOW);
    const twice = withSkippedPhase(once, 'try', LATER);
    expect(twice).toBe(once);
  });
});

describe('withoutSkippedPhase', () => {
  it('removes a marked phase, keeping any others', () => {
    let progress = withSkippedPhase(makeProgress(), 'story', NOW);
    progress = withSkippedPhase(progress, 'demo', NOW);
    progress = withoutSkippedPhase(progress, 'story', LATER);
    expect(progress.skippedPhases).toEqual(['demo']);
    expect(progress.updatedAt).toBe(LATER.toISOString());
  });

  it('is a no-op (same object) when the phase was never marked', () => {
    const progress = makeProgress();
    expect(withoutSkippedPhase(progress, 'demo', LATER)).toBe(progress);
  });

  it('is a no-op (same object) when skippedPhases is absent', () => {
    const progress = withSkippedPhase(makeProgress(), 'try', NOW);
    const cleared = withoutSkippedPhase(progress, 'try', LATER);
    expect(withoutSkippedPhase(cleared, 'try', LATER)).toBe(cleared);
  });
});

describe('lessonStatus', () => {
  const lesson = makeLesson(); // 3 exercises, max 9 stars; 80% of 9 = 7.2

  it('is new without progress', () => {
    expect(lessonStatus(lesson, undefined)).toBe('new');
  });

  it('is in-progress when some, but not all, exercises are scored', () => {
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 2, lesson, NOW);
    expect(lessonStatus(lesson, progress)).toBe('in-progress');
  });

  it('is complete once every exercise has ≥ 1 star, below the mastery threshold', () => {
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 1, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-02', 1, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-03', 1, lesson, NOW);
    expect(lessonStatus(lesson, progress)).toBe('complete');
  });

  it('is mastered once the best-stars sum passes 80% of max (8/9 stars)', () => {
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 3, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-02', 3, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-03', 2, lesson, NOW);
    expect(lessonStatus(lesson, progress)).toBe('mastered');
  });

  it('is not mastered just below the 80% boundary (7/9 stars)', () => {
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 3, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-02', 3, lesson, NOW);
    progress = recordExerciseStars(progress, 'rook-03', 1, lesson, NOW);
    expect(lessonStatus(lesson, progress)).toBe('complete');
  });

  it('is mastered exactly at the 80% boundary with a five-exercise lesson (12/15 stars)', () => {
    const five = makeLesson({
      exercises: [
        makeExercise('e1'),
        makeExercise('e2'),
        makeExercise('e3'),
        makeExercise('e4'),
        makeExercise('e5'),
      ],
    });
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'e1', 3, five, NOW);
    progress = recordExerciseStars(progress, 'e2', 3, five, NOW);
    progress = recordExerciseStars(progress, 'e3', 3, five, NOW);
    progress = recordExerciseStars(progress, 'e4', 2, five, NOW);
    progress = recordExerciseStars(progress, 'e5', 1, five, NOW);
    expect(lessonStatus(five, progress)).toBe('mastered');
  });
});

describe('lessonStars', () => {
  it('is 0 / max without progress, max excludes the boss when the lesson has none', () => {
    const lesson = makeLesson();
    expect(lessonStars(lesson, undefined)).toEqual({ earned: 0, max: 9 });
  });

  it('adds 3 to max, and bossStars to earned, when the lesson has a boss', () => {
    const lesson = makeLesson({ boss: 'hungry-rook' });
    let progress = makeProgress();
    progress = recordExerciseStars(progress, 'rook-01', 3, lesson, NOW);
    progress = recordBossStars(progress, 2, NOW);
    expect(lessonStars(lesson, progress)).toEqual({ earned: 5, max: 12 });
  });
});

describe('recordMiniGamePlay', () => {
  it('starts a fresh record on the first play', () => {
    const progress = recordMiniGamePlay(undefined, 'mg1', 'profile-1', 'hungry-rook', 2, true, NOW);
    expect(progress).toMatchObject({
      id: 'mg1',
      profileId: 'profile-1',
      miniGameId: 'hungry-rook',
      bestStars: 2,
      plays: 1,
      wins: 1,
    });
  });

  it('keeps the higher of the two best-stars, and always bumps plays', () => {
    const first = recordMiniGamePlay(undefined, 'mg1', 'profile-1', 'hungry-rook', 3, true, NOW);
    const second = recordMiniGamePlay(first, 'mg2', 'profile-1', 'hungry-rook', 1, false, LATER);
    expect(second.id).toBe('mg1'); // the fresh id is only used the first time
    expect(second.bestStars).toBe(3);
    expect(second.plays).toBe(2);
    expect(second.wins).toBe(1); // the second play did not win
    expect(second.updatedAt).toBe(LATER.toISOString());
    expect(second.createdAt).toBe(NOW.toISOString());
  });

  it('counts a loss as a play without a win', () => {
    const progress = recordMiniGamePlay(undefined, 'mg1', 'p1', 'pawn-wars', 1, false, NOW);
    expect(progress).toMatchObject({ plays: 1, wins: 0 });
  });
});

describe('totalStars', () => {
  it('sums exercise and boss stars across every given progress', () => {
    const lesson = makeLesson({ boss: 'hungry-rook' });
    let a = makeProgress({ id: 'a', lessonId: 'rook' });
    a = recordExerciseStars(a, 'rook-01', 3, lesson, NOW);
    a = recordBossStars(a, 2, NOW);
    let b = makeProgress({ id: 'b', lessonId: 'bishop' });
    b = recordExerciseStars(b, 'bishop-01', 1, makeLesson({ id: 'bishop' }), NOW);

    expect(totalStars([a, b])).toBe(3 + 2 + 1);
    expect(totalStars([])).toBe(0);
  });
});
