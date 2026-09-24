import { describe, expect, it } from 'vitest';

import type { ExerciseDef } from './exercise/types.ts';
import type { Lesson, MiniGame, StaticMiniGame } from './lesson.ts';
import { newLessonProgress, recordBossStars, recordExerciseStars } from './progress.ts';
import type { LessonProgress } from './progress.ts';
import { unlockedMiniGames } from './play.ts';

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
    concept: 'rook-move',
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

function makeLesson(id: string, overrides: Partial<Lesson> = {}): Lesson {
  return {
    id,
    world: 'pieces',
    order: 1,
    concept: 'rook-move',
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [makeExercise(`${id}-01`)],
    boss: `${id}-boss`,
    ...overrides,
  };
}

function makeMiniGame(unlockAfter: string, id = `${unlockAfter}-boss`): StaticMiniGame {
  return {
    mode: 'static',
    id,
    concept: 'rook-move',
    position: EMPTY_POSITION,
    par: 3,
    titleKey: `minigames:${id}.title`,
    goalKey: `minigames:${id}.goal`,
    unlockAfter,
  };
}

const ROOK = makeLesson('rook');
const BISHOP = makeLesson('bishop');
const LESSONS: readonly Lesson[] = [ROOK, BISHOP];
const ROOK_BOSS = makeMiniGame('rook');
const BISHOP_BOSS = makeMiniGame('bishop');
const MINIGAMES: readonly MiniGame[] = [ROOK_BOSS, BISHOP_BOSS];

function freshProgress(lessonId: string): LessonProgress {
  return newLessonProgress(`p-${lessonId}`, 'profile-1', lessonId, NOW);
}

describe('unlockedMiniGames', () => {
  it('is locked, 0 best stars, when the unlocking lesson has no progress', () => {
    const result = unlockedMiniGames(LESSONS, MINIGAMES, []);
    expect(result).toEqual([
      { minigame: ROOK_BOSS, unlocked: false, bestStars: 0 },
      { minigame: BISHOP_BOSS, unlocked: false, bestStars: 0 },
    ]);
  });

  it('unlocks once the lesson is complete, independent of the other mini-games', () => {
    const rookProgress = recordExerciseStars(freshProgress('rook'), 'rook-01', 1, ROOK, NOW);
    const result = unlockedMiniGames(LESSONS, MINIGAMES, [rookProgress]);
    expect(result.find((r) => r.minigame.id === ROOK_BOSS.id)?.unlocked).toBe(true);
    expect(result.find((r) => r.minigame.id === BISHOP_BOSS.id)?.unlocked).toBe(false);
  });

  it('reports the lesson boss slot best stars as a fallback', () => {
    let rookProgress = recordExerciseStars(freshProgress('rook'), 'rook-01', 1, ROOK, NOW);
    rookProgress = recordBossStars(rookProgress, 2, NOW);
    const result = unlockedMiniGames(LESSONS, MINIGAMES, [rookProgress]);
    expect(result.find((r) => r.minigame.id === ROOK_BOSS.id)?.bestStars).toBe(2);
  });
});
