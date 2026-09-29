import { describe, expect, it } from 'vitest';

import { parseFen } from '../chess/fen.ts';
import type { Lesson, VersusMiniGame } from '../chess/lesson.ts';
import { newLessonProgress } from '@learn/platform-core/domain/progress';
import type { GameRecord, LessonProgress } from '@learn/platform-core/domain/progress';
import { makeGameRecordRepo as buildGameRecordRepo } from '@learn/platform-core/testing';
import { makeDeps as buildDeps } from '../../testing/index.ts';
import {
  friendGameOptions,
  friendGamesPlayed,
  isFriendOpponent,
  recordLocalMatch,
} from './friend-play.ts';
import type { Journey } from '@learn/platform-core/app/journey';
import type { AppDeps } from '@learn/platform-core/app/use-cases';
import type { GameRecordRepository } from '@learn/platform-core/app/ports';

function makeGameRecordRepo(
  initial: readonly GameRecord[] = [],
): GameRecordRepository & { readonly all: readonly GameRecord[] } {
  const all: GameRecord[] = [...initial];
  const repo = buildGameRecordRepo(initial);
  return {
    ...repo,
    add: (record) => {
      all.push(record);
      return repo.add(record);
    },
    all,
  };
}

function makeDeps(gameRecords: GameRecordRepository = buildGameRecordRepo()): AppDeps {
  return buildDeps({ gameRecords });
}

describe('recordLocalMatch', () => {
  it('saves one win and one loss record, opponent tagged by profile id', async () => {
    const gameRecords = makeGameRecordRepo();
    const deps = makeDeps(gameRecords);

    const saved = await recordLocalMatch(deps, {
      game: 'full',
      white: { kind: 'profile', profileId: 'alice' },
      black: { kind: 'profile', profileId: 'bob' },
      outcome: { kind: 'result', result: { kind: 'win', winner: 'w', reason: 'checkmate' } },
      moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'],
    });

    expect(saved).toHaveLength(2);
    const alice = saved.find((record) => record.profileId === 'alice');
    const bob = saved.find((record) => record.profileId === 'bob');
    expect(alice).toMatchObject({
      profileId: 'alice',
      game: 'full',
      opponent: 'profile:bob',
      result: 'win',
      reason: 'checkmate',
    });
    expect(bob).toMatchObject({
      profileId: 'bob',
      game: 'full',
      opponent: 'profile:alice',
      result: 'loss',
      reason: 'checkmate',
      color: 'b',
    });
    expect(alice?.color).toBe('w');
    expect(gameRecords.all).toHaveLength(2);
  });

  it('tags a guest opponent as "guest" and saves no record for the guest', async () => {
    const gameRecords = makeGameRecordRepo();
    const deps = makeDeps(gameRecords);

    const saved = await recordLocalMatch(deps, {
      game: 'full',
      white: { kind: 'profile', profileId: 'alice' },
      black: { kind: 'guest' },
      outcome: { kind: 'result', result: { kind: 'win', winner: 'w', reason: 'checkmate' } },
      moves: ['e4'],
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ profileId: 'alice', opponent: 'guest', result: 'win' });
    expect(gameRecords.all).toHaveLength(1);
  });

  it('both profiles draw', async () => {
    const deps = makeDeps();
    const saved = await recordLocalMatch(deps, {
      game: 'pawn-wars',
      white: { kind: 'profile', profileId: 'alice' },
      black: { kind: 'profile', profileId: 'bob' },
      outcome: { kind: 'result', result: { kind: 'draw', reason: 'move-limit' } },
      moves: [],
    });

    expect(saved.every((record) => record.result === 'draw')).toBe(true);
  });

  it('an abandoned match records "abandoned" / "left" for both profiles', async () => {
    const deps = makeDeps();
    const saved = await recordLocalMatch(deps, {
      game: 'full',
      white: { kind: 'profile', profileId: 'alice' },
      black: { kind: 'profile', profileId: 'bob' },
      outcome: { kind: 'abandoned' },
      moves: ['e4'],
    });

    expect(saved).toHaveLength(2);
    for (const record of saved) {
      expect(record.result).toBe('abandoned');
      expect(record.reason).toBe('left');
    }
  });
});

describe('isFriendOpponent / friendGamesPlayed', () => {
  it('tells a friend opponent from a computer one', () => {
    expect(isFriendOpponent('guest')).toBe(true);
    expect(isFriendOpponent('profile:abc')).toBe(true);
    expect(isFriendOpponent('computer:3')).toBe(false);
  });

  it('counts non-abandoned friend games only', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const base: GameRecord = {
      id: 'r',
      profileId: 'alice',
      game: 'full',
      opponent: 'computer:1',
      result: 'win',
      reason: 'checkmate',
      moves: [],
      createdAt: now,
      updatedAt: now,
    };
    const records: GameRecord[] = [
      base,
      { ...base, id: 'r2', opponent: 'profile:bob', result: 'win' },
      { ...base, id: 'r3', opponent: 'guest', result: 'loss' },
      { ...base, id: 'r4', opponent: 'guest', result: 'abandoned' },
    ];
    expect(friendGamesPlayed(records)).toBe(2);
  });
});

describe('friendGameOptions', () => {
  const EMPTY_POSITION = {
    pieces: {},
    markers: { stars: [], blocked: [] },
    toMove: 'w' as const,
    castling: '-',
    enPassant: null,
  };

  function makeJourney(checkWorldStatus: 'locked' | 'available' | 'mastered'): Journey {
    return {
      catalog: { tracks: [], ranks: [] },
      lessons: [],
      statuses: new Map(),
      worlds: [
        {
          world: { id: 'check', track: 'basics', order: 4, habitat: 'mountains', titleKey: 'x' },
          status: checkWorldStatus,
          bossStatus: 'none',
        },
      ],
      next: null,
      nextStep: null,
      rank: undefined,
      totalStars: 0,
    };
  }

  const PROMOTION_LESSON: Lesson = {
    id: 'promotion',
    world: 'check',
    order: 1,
    concept: 'promotion',
    character: 'rhino',
    titleKey: 'lessons:promotion.title',
    storyKey: 'lessons:promotion.story',
    demo: {
      position: EMPTY_POSITION,
      textKey: 'lessons:promotion.demo',
      highlight: { squares: [] },
    },
    guided: [],
    exercises: [],
  };

  const PAWN_WARS: VersusMiniGame = {
    mode: 'versus',
    id: 'pawn-wars',
    concept: 'promotion',
    position: parseFen('8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1'),
    rules: {
      kings: false,
      checkRules: false,
      noMoves: 'lose',
      win: { w: [{ kind: 'promote' }], b: [{ kind: 'promote' }] },
    },
    opponentLevel: 1,
    kidColor: 'w',
    titleKey: 'minigames:pawn-wars.title',
    goalKey: 'minigames:pawn-wars.goal',
    unlockAfter: 'promotion',
  };

  it('offers nothing when no game is unlocked yet', () => {
    const options = friendGameOptions(
      [],
      makeJourney('available'),
      [PROMOTION_LESSON],
      [PAWN_WARS],
      [],
    );
    expect(options).toEqual([]);
  });

  it('offers the full game once World 4 is mastered', () => {
    const options = friendGameOptions([], makeJourney('mastered'), [], [], []);
    expect(options).toEqual([{ id: 'full', titleKey: 'play.full-game-title' }]);
  });

  it('offers an unlocked versus mini-game even while the full game stays locked', () => {
    const progress: LessonProgress[] = [
      newLessonProgress('p1', 'profile-1', 'promotion', new Date('2026-01-01T00:00:00.000Z')),
    ];
    const options = friendGameOptions(
      [],
      makeJourney('available'),
      [PROMOTION_LESSON],
      [PAWN_WARS],
      progress,
    );
    expect(options).toEqual([{ id: 'pawn-wars', titleKey: 'minigames:pawn-wars.title' }]);
  });
});
