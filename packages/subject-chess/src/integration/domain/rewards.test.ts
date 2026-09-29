import { describe, expect, it } from 'vitest';

import { makeExercise, makeLesson as buildLesson } from '@learn/platform-core/testing';
import type { Track, TracksCatalog, World } from '@learn/platform-core/domain/journey';
import type { Lesson } from '@learn/platform-core/domain/lesson';
import { newLessonProgress, recordExerciseStars } from '@learn/platform-core/domain/progress';
import type { LessonProgress } from '@learn/platform-core/domain/progress';
import { animalFriends, rankLadder } from '@learn/platform-core/domain/rewards';
import type { SubjectCore } from '@learn/platform-core/domain/subject';

const NOW = new Date('2026-01-01T00:00:00.000Z');

/** Same shape/order as chess's own `CHESS_CHARACTERS` (`chess-core.ts`) — kept local so this
 * platform-bound test never imports chess-bound code. */
const CHARACTERS: SubjectCore['characters'] = {
  rhino: { topicKey: 'piece.r' },
  elephant: { topicKey: 'piece.b' },
  lioness: { topicKey: 'piece.q' },
  lion: { topicKey: 'piece.k' },
  horse: { topicKey: 'piece.n' },
  caterpillar: { topicKey: 'piece.p' },
};

function makeLesson(id: string, character: string, order: number): Lesson {
  return buildLesson({
    id,
    order,
    concept: `${id}-move`,
    character,
    exercises: [makeExercise({ id: `${id}-01`, concept: `${id}-01-concept` })],
  });
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
    const friends = animalFriends(ALL_LESSONS, [], CHARACTERS);
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
      topicKey: 'piece.r',
      lessonId: 'rook',
    });
  });

  it('marks a friend earned once its lesson is complete', () => {
    const friends = animalFriends(ALL_LESSONS, [completeProgress(ROOK)], CHARACTERS);
    expect(friends.find((f) => f.character === 'rhino')?.earned).toBe(true);
    expect(friends.find((f) => f.character === 'elephant')?.earned).toBe(false);
  });

  it("ties caterpillar's friend to the pawn lesson, not the later promotion lesson", () => {
    const friends = animalFriends(ALL_LESSONS, [completeProgress(PROMOTION)], CHARACTERS);
    const caterpillar = friends.find((f) => f.character === 'caterpillar');
    expect(caterpillar?.lessonId).toBe('pawn');
    // Completing only `promotion` (not `pawn`) does not earn the friend tied to `pawn`.
    expect(caterpillar?.earned).toBe(false);
  });

  it('skips a character with no authored lesson yet', () => {
    const friends = animalFriends([ROOK], [], CHARACTERS);
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
