import { describe, expect, it } from 'vitest';

import type { Track, TracksCatalog, World } from './journey.ts';
import type { Lesson } from './lesson.ts';
import type { ExerciseDef } from './exercise/types.ts';
import { newLessonProgress, recordExerciseStars } from './progress.ts';
import type { LessonProgress } from './progress.ts';
import { animalFriends, rankLadder } from './rewards.ts';

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

const NOW = new Date('2026-01-01T00:00:00.000Z');

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

function makeLesson(id: string, character: string, order: number): Lesson {
  return {
    id,
    world: 'pieces',
    order,
    concept: `${id}-move`,
    character,
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [makeExercise(`${id}-01`)],
  };
}

function completeProgress(lesson: Lesson): LessonProgress {
  const fresh = newLessonProgress(`p-${lesson.id}`, 'profile-1', lesson.id, NOW);
  return recordExerciseStars(fresh, `${lesson.id}-01`, 1, lesson, NOW);
}

/** 3 stars on its one exercise: `mastered` (100% of max), needed to satisfy a `world:` rank. */
function masteredProgress(lesson: Lesson): LessonProgress {
  const fresh = newLessonProgress(`p-${lesson.id}`, 'profile-1', lesson.id, NOW);
  return recordExerciseStars(fresh, `${lesson.id}-01`, 3, lesson, NOW);
}

const ROOK = makeLesson('rook', 'rhino', 1);
const BISHOP = makeLesson('bishop', 'elephant', 2);
const QUEEN = makeLesson('queen', 'lioness', 3);
const KING = makeLesson('king', 'lion', 4);
const KNIGHT = makeLesson('knight', 'horse', 5);
const PAWN = makeLesson('pawn', 'caterpillar', 6);
const PROMOTION = makeLesson('promotion', 'caterpillar', 7);
const ALL_LESSONS = [ROOK, BISHOP, QUEEN, KING, KNIGHT, PAWN, PROMOTION];

describe('animalFriends', () => {
  it('lists all six World-2 friends, unearned without any progress', () => {
    const friends = animalFriends(ALL_LESSONS, []);
    expect(friends.map((f) => f.character)).toEqual([
      'rhino',
      'elephant',
      'lioness',
      'lion',
      'horse',
      'caterpillar',
    ]);
    expect(friends.every((f) => !f.earned)).toBe(true);
    expect(friends.find((f) => f.character === 'rhino')).toMatchObject({
      piece: 'r',
      lessonId: 'rook',
    });
  });

  it('marks a friend earned once its lesson is complete', () => {
    const friends = animalFriends(ALL_LESSONS, [completeProgress(ROOK)]);
    expect(friends.find((f) => f.character === 'rhino')?.earned).toBe(true);
    expect(friends.find((f) => f.character === 'elephant')?.earned).toBe(false);
  });

  it("ties caterpillar's friend to the pawn lesson, not the later promotion lesson", () => {
    const friends = animalFriends(ALL_LESSONS, [completeProgress(PROMOTION)]);
    const caterpillar = friends.find((f) => f.character === 'caterpillar');
    expect(caterpillar?.lessonId).toBe('pawn');
    // Completing only `promotion` (not `pawn`) does not earn the friend tied to `pawn`.
    expect(caterpillar?.earned).toBe(false);
  });

  it('skips a character with no authored lesson yet', () => {
    const friends = animalFriends([ROOK], []);
    expect(friends).toHaveLength(1);
    expect(friends[0]?.character).toBe('rhino');
  });
});

const W1: World = { id: 'w1', track: 'basics', order: 1, habitat: 'meadow', titleKey: 'w1' };
const W2: World = { id: 'w2', track: 'basics', order: 2, habitat: 'savannah', titleKey: 'w2' };
const BASICS: Track = { id: 'basics', kind: 'main', titleKey: 'basics', worlds: [W1, W2] };
const CATALOG: TracksCatalog = {
  tracks: [BASICS],
  ranks: [
    { id: 'pawn', after: 'start' },
    { id: 'knight', after: 'world:w1' },
    { id: 'bishop', after: 'world:w2' },
  ],
};

function lessonOfWorld(id: string, world: string, order: number): Lesson {
  return { ...makeLesson(id, 'rhino', order), world };
}

describe('rankLadder', () => {
  it('tags every rank before the current one done, the current one current, the rest locked', () => {
    const l1 = lessonOfWorld('l1', 'w1', 1);
    const ladder = rankLadder(CATALOG, [l1], [masteredProgress(l1)]);
    expect(ladder.map((entry) => entry.state)).toEqual(['done', 'current', 'locked']);
    expect(ladder.map((entry) => entry.rank.id)).toEqual(['pawn', 'knight', 'bishop']);
  });

  it('the lowest rank is current when nothing is mastered yet', () => {
    const ladder = rankLadder(CATALOG, [], []);
    expect(ladder.map((entry) => entry.state)).toEqual(['current', 'locked', 'locked']);
  });
});
