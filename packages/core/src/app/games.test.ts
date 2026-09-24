import { describe, expect, it } from 'vitest';

import type { GameRecord } from '../domain/progress.ts';
import type { Profile } from '../domain/profile.ts';
import { seededRandom } from '../domain/random.ts';
import type { Journey } from './journey.ts';
import { computerLevelStatus, loadGameRecords, recordGame } from './games.ts';
import type { AppDeps } from './use-cases.ts';
import type {
  AppSettings,
  Clock,
  ContentSource,
  GameRecordRepository,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  SettingsRepository,
} from './ports.ts';

function makeIds(prefix = 'id'): IdGenerator {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return `${prefix}-${String(count)}`;
    },
  };
}

function makeClock(iso = '2026-01-01T00:00:00.000Z'): Clock {
  return { now: () => new Date(iso) };
}

function makeGameRecordRepo(initial: readonly GameRecord[] = []): GameRecordRepository {
  const records: GameRecord[] = [...initial];
  return {
    add: (record) => {
      records.push(record);
      return Promise.resolve();
    },
    listByProfile: (profileId) =>
      Promise.resolve(records.filter((record) => record.profileId === profileId)),
    deleteProfileData: (profileId) => {
      for (let i = records.length - 1; i >= 0; i -= 1) {
        if (records[i]?.profileId === profileId) records.splice(i, 1);
      }
      return Promise.resolve();
    },
  };
}

const stubProgress: ProgressRepository = {
  listLessons: () => Promise.resolve([]),
  getLesson: () => Promise.resolve(undefined),
  saveLesson: () => Promise.resolve(),
  addAttempt: () => Promise.resolve(),
  listAttempts: () => Promise.resolve([]),
  getMiniGame: () => Promise.resolve(undefined),
  listMiniGames: () => Promise.resolve([]),
  saveMiniGame: () => Promise.resolve(),
  getConceptStats: () => Promise.resolve(undefined),
  listConceptStats: () => Promise.resolve([]),
  saveConceptStats: () => Promise.resolve(),
  deleteProfileData: () => Promise.resolve(),
};

const stubContent: ContentSource = {
  lessons: () => [],
  lesson: () => undefined,
  minigames: () => [],
  minigame: () => undefined,
};

function makeDeps(records: readonly GameRecord[] = []): AppDeps {
  return {
    profiles: {
      list: () => Promise.resolve<Profile[]>([]),
      get: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    } satisfies ProfileRepository,
    progress: stubProgress,
    gameRecords: makeGameRecordRepo(records),
    clock: makeClock(),
    ids: makeIds(),
    content: stubContent,
    parentLock: {
      get: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
    } satisfies ParentLockRepository,
    passwordFile: {
      write: (password) => Promise.resolve({ location: `fake/${password}.txt` }),
    } satisfies PasswordFileWriter,
    settings: {
      get: () => Promise.resolve<AppSettings>({ lastProfileId: null }),
      save: () => Promise.resolve(),
    } satisfies SettingsRepository,
    random: seededRandom(1),
  };
}

function record(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'r1',
    profileId: 'profile-1',
    game: 'full',
    opponent: 'computer:1',
    result: 'win',
    reason: 'checkmate',
    moves: ['e4', 'e5'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A minimal `Journey`, only ever read for `worlds` by `computerLevelStatus`. */
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

describe('recordGame / loadGameRecords', () => {
  it('saves a GameRecord with a "computer:<level>" opponent and returns it', async () => {
    const deps = makeDeps();

    const saved = await recordGame(deps, {
      profileId: 'profile-1',
      game: 'full',
      opponentLevel: 1,
      result: 'win',
      reason: 'checkmate',
      moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'],
    });

    expect(saved).toMatchObject({
      id: 'id-1',
      profileId: 'profile-1',
      game: 'full',
      opponent: 'computer:1',
      result: 'win',
      reason: 'checkmate',
    });
    expect(await loadGameRecords(deps, 'profile-1')).toEqual([saved]);
    expect(await loadGameRecords(deps, 'someone-else')).toEqual([]);
  });
});

describe('computerLevelStatus', () => {
  it('Mouse locked before World 4 is mastered; Rabbit and up locked with their condition', () => {
    const statuses = computerLevelStatus([], makeJourney('available'));

    expect(statuses).toHaveLength(5);
    const mouse = statuses.find((s) => s.name === 'mouse');
    expect(mouse).toMatchObject({
      level: 1,
      locked: true,
      condition: { kind: 'world-mastered', worldId: 'check' },
      wins: 0,
      games: 0,
    });
    const rabbit = statuses.find((s) => s.name === 'rabbit');
    expect(rabbit).toMatchObject({
      level: 2,
      locked: true,
      condition: { kind: 'beat', level: 'mouse', times: 3 },
    });
    const fox = statuses.find((s) => s.name === 'fox');
    expect(fox).toMatchObject({
      level: 3,
      locked: true,
      condition: { kind: 'beat', level: 'rabbit', times: 3 },
    });
    const wolf = statuses.find((s) => s.name === 'wolf');
    expect(wolf).toMatchObject({ condition: { kind: 'beat', level: 'fox', times: 3 } });
    const bear = statuses.find((s) => s.name === 'bear');
    expect(bear).toMatchObject({ condition: { kind: 'beat', level: 'wolf', times: 3 } });
  });

  it('Mouse unlocks once World 4 is mastered; Rabbit stays locked under 3 full-game wins', () => {
    const records = [
      record({ id: 'r1', result: 'win' }),
      record({ id: 'r2', result: 'win' }),
      record({ id: 'r3', result: 'loss' }),
    ];

    const statuses = computerLevelStatus(records, makeJourney('mastered'));

    const mouse = statuses.find((s) => s.name === 'mouse');
    expect(mouse).toMatchObject({ locked: false, wins: 2, games: 3 });
    expect(mouse?.condition).toBeUndefined();

    const rabbit = statuses.find((s) => s.name === 'rabbit');
    expect(rabbit).toMatchObject({
      locked: true,
      condition: { kind: 'beat', level: 'mouse', times: 3 },
    });
  });

  it('Rabbit unlocks once the kid has 3 full-game wins vs Mouse', () => {
    const records = [
      record({ id: 'r1', result: 'win' }),
      record({ id: 'r2', result: 'win' }),
      record({ id: 'r3', result: 'win' }),
    ];

    const statuses = computerLevelStatus(records, makeJourney('mastered'));

    const rabbit = statuses.find((s) => s.name === 'rabbit');
    expect(rabbit).toMatchObject({ locked: false, wins: 0, games: 0 });
  });

  it('ignores mini-game and abandoned records: only "full" games vs the right level count', () => {
    const records = [
      record({ id: 'r1', result: 'win' }),
      record({ id: 'r2', result: 'win' }),
      record({ id: 'r3', result: 'win', game: 'pawn-wars' }), // not a full game
      record({ id: 'r4', result: 'win', opponent: 'computer:2' }), // a different level
      record({ id: 'r5', result: 'abandoned' }),
    ];

    const statuses = computerLevelStatus(records, makeJourney('mastered'));

    const mouse = statuses.find((s) => s.name === 'mouse');
    expect(mouse).toMatchObject({ wins: 2, games: 2 });
    const rabbit = statuses.find((s) => s.name === 'rabbit');
    expect(rabbit?.locked).toBe(true); // only 2 full-game wins vs Mouse, not 3
  });
});
