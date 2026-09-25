import { describe, expect, it } from 'vitest';

import type { GameRecord } from '../domain/progress.ts';
import type { Profile } from '../domain/profile.ts';
import { seededRandom } from '../domain/random.ts';
import type { Journey } from './journey.ts';
import {
  computerLevelStatus,
  loadGameRecords,
  nextSuggestedLevel,
  recordGame,
  suggestedLevel,
  updateSuggestedLevel,
} from './games.ts';
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

/** In-memory `SettingsRepository`, so `updateSuggestedLevel`'s save-then-get round-trips. */
function makeSettingsRepo(
  initial: AppSettings = { lastProfileId: null, suggestedLevels: {}, profileSettings: {} },
): SettingsRepository {
  let settings = initial;
  return {
    get: () => Promise.resolve(settings),
    save: (next) => {
      settings = next;
      return Promise.resolve();
    },
  };
}

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
    settings: makeSettingsRepo(),
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
      record({ id: 'r4', result: 'win', opponent: 'computer:3' }), // a different level (Fox)
      record({ id: 'r5', result: 'abandoned' }),
    ];

    const statuses = computerLevelStatus(records, makeJourney('mastered'));

    const mouse = statuses.find((s) => s.name === 'mouse');
    expect(mouse).toMatchObject({ wins: 2, games: 2 });
    const rabbit = statuses.find((s) => s.name === 'rabbit');
    expect(rabbit?.locked).toBe(true); // only 2 full-game wins vs Mouse, not 3, and no own win yet
  });

  it('a level with any recorded full-game win of its own stays unlocked short of 3 wins below it', () => {
    // Covers a world boss fought directly at Rabbit (e.g. World 5's, authored in parallel) before
    // the kid has separately won 3 Play-screen games vs Mouse.
    const records = [record({ id: 'r1', result: 'win', opponent: 'computer:2' })];

    const statuses = computerLevelStatus(records, makeJourney('mastered'));

    const rabbit = statuses.find((s) => s.name === 'rabbit');
    expect(rabbit).toMatchObject({ locked: false, wins: 1, games: 1 });
    expect(rabbit?.condition).toBeUndefined();
  });

  it('an own-level win unlocks Fox/Wolf/Bear too, the same way', () => {
    const fox = computerLevelStatus(
      [record({ id: 'r1', result: 'win', opponent: 'computer:3' })],
      makeJourney('mastered'),
    ).find((s) => s.name === 'fox');
    expect(fox?.locked).toBe(false);

    const wolf = computerLevelStatus(
      [record({ id: 'r1', result: 'win', opponent: 'computer:4' })],
      makeJourney('mastered'),
    ).find((s) => s.name === 'wolf');
    expect(wolf?.locked).toBe(false);

    const bear = computerLevelStatus(
      [record({ id: 'r1', result: 'draw', opponent: 'computer:5' })],
      makeJourney('mastered'),
    ).find((s) => s.name === 'bear');
    expect(bear?.locked).toBe(true); // a draw is not a win
  });

  it('Fox/Wolf/Bear unlock with 3 full-game wins vs the level right below', () => {
    const winsVs = (level: number) =>
      Array.from({ length: 3 }, (_, i) =>
        record({
          id: `w${String(level)}-${String(i)}`,
          result: 'win',
          opponent: `computer:${String(level)}`,
        }),
      );

    const foxStatuses = computerLevelStatus(winsVs(2), makeJourney('mastered'));
    expect(foxStatuses.find((s) => s.name === 'fox')?.locked).toBe(false);
    expect(foxStatuses.find((s) => s.name === 'wolf')?.locked).toBe(true);

    const wolfStatuses = computerLevelStatus(winsVs(3), makeJourney('mastered'));
    expect(wolfStatuses.find((s) => s.name === 'wolf')?.locked).toBe(false);
    expect(wolfStatuses.find((s) => s.name === 'bear')?.locked).toBe(true);

    const bearStatuses = computerLevelStatus(winsVs(4), makeJourney('mastered'));
    expect(bearStatuses.find((s) => s.name === 'bear')?.locked).toBe(false);
  });
});

describe('nextSuggestedLevel', () => {
  const UNLOCKED_STATUSES = ['mouse', 'rabbit', 'fox', 'wolf', 'bear'].map((name, index) => ({
    level: (index + 1) as 1 | 2 | 3 | 4 | 5,
    name: name as 'mouse' | 'rabbit' | 'fox' | 'wolf' | 'bear',
    locked: false,
    wins: 0,
    games: 0,
  }));

  const LOCKED_ABOVE_FOX = UNLOCKED_STATUSES.map((status) =>
    status.level >= 4 ? { ...status, locked: true } : status,
  );

  function winsAndLosses(level: number, results: readonly ('win' | 'loss')[]): GameRecord[] {
    return results.map((result, index) =>
      record({
        id: `g${String(level)}-${String(index)}`,
        result,
        opponent: `computer:${String(level)}`,
        createdAt: `2026-01-01T00:0${String(index)}:00.000Z`,
      }),
    );
  }

  it('returns null before 5 full games have been played at that level', () => {
    const records = winsAndLosses(3, ['win', 'win', 'win', 'win']);
    expect(nextSuggestedLevel(records, 3, UNLOCKED_STATUSES)).toBeNull();
  });

  it('suggests the next level once >= 4 of the last 5 games are wins, if it is unlocked', () => {
    const records = winsAndLosses(3, ['win', 'win', 'win', 'win', 'loss']);
    expect(nextSuggestedLevel(records, 3, UNLOCKED_STATUSES)).toEqual({
      level: 4,
      leveledUp: true,
    });
  });

  it('does not suggest a next level that is still locked', () => {
    const records = winsAndLosses(3, ['win', 'win', 'win', 'win', 'win']);
    expect(nextSuggestedLevel(records, 3, LOCKED_ABOVE_FOX)).toBeNull();
  });

  it('drops one level once <= 1 of the last 5 games is a win', () => {
    const records = winsAndLosses(3, ['loss', 'loss', 'loss', 'loss', 'win']);
    expect(nextSuggestedLevel(records, 3, UNLOCKED_STATUSES)).toEqual({
      level: 2,
      leveledUp: false,
    });
  });

  it('never drops below Mouse', () => {
    const records = winsAndLosses(1, ['loss', 'loss', 'loss', 'loss', 'loss']);
    expect(nextSuggestedLevel(records, 1, UNLOCKED_STATUSES)).toBeNull();
  });

  it('does nothing in the middle band (2 or 3 wins of the last 5)', () => {
    const records = winsAndLosses(3, ['win', 'win', 'loss', 'loss', 'loss']);
    expect(nextSuggestedLevel(records, 3, UNLOCKED_STATUSES)).toBeNull();
  });

  it('only ever moves one level, never more, even with a perfect streak', () => {
    const records = winsAndLosses(2, ['win', 'win', 'win', 'win', 'win']);
    const update = nextSuggestedLevel(records, 2, UNLOCKED_STATUSES);
    expect(update?.level).toBe(3);
  });

  it('only looks at the last 5 games at that level: an older 0-win run does not still count', () => {
    const stale = winsAndLosses(3, ['loss', 'loss', 'loss', 'loss', 'loss']).map((r, i) => ({
      ...r,
      id: `stale-${String(i)}`,
      createdAt: `2020-01-01T00:0${String(i)}:00.000Z`,
    }));
    const recent = winsAndLosses(3, ['win', 'win', 'win', 'win', 'win']);
    expect(nextSuggestedLevel([...stale, ...recent], 3, UNLOCKED_STATUSES)).toEqual({
      level: 4,
      leveledUp: true,
    });
  });

  it('ignores abandoned games in the last-5 window', () => {
    const abandoned = record({
      id: 'left',
      result: 'abandoned',
      opponent: 'computer:3',
      createdAt: '2026-01-01T00:09:00.000Z',
    });
    const records = [...winsAndLosses(3, ['win', 'win', 'win', 'win', 'win']), abandoned];
    expect(nextSuggestedLevel(records, 3, UNLOCKED_STATUSES)).toEqual({
      level: 4,
      leveledUp: true,
    });
  });
});

describe('suggestedLevel', () => {
  const STATUSES = [
    { level: 1 as const, name: 'mouse' as const, locked: false, wins: 0, games: 0 },
    { level: 2 as const, name: 'rabbit' as const, locked: false, wins: 0, games: 0 },
    { level: 3 as const, name: 'fox' as const, locked: true, wins: 0, games: 0 },
  ];

  it('uses the stored suggestion when it still names an unlocked level', () => {
    expect(suggestedLevel(2, STATUSES)).toBe(2);
  });

  it('falls back to the highest unlocked level with no suggestion stored', () => {
    expect(suggestedLevel(undefined, STATUSES)).toBe(2);
  });

  it('falls back to the highest unlocked level when the stored one is locked', () => {
    expect(suggestedLevel(3, STATUSES)).toBe(2);
  });

  it('falls back to Mouse when nothing at all is unlocked', () => {
    const allLocked = STATUSES.map((status) => ({ ...status, locked: true }));
    expect(suggestedLevel(undefined, allLocked)).toBe(1);
  });
});

describe('updateSuggestedLevel', () => {
  const STATUSES = ['mouse', 'rabbit', 'fox', 'wolf', 'bear'].map((name, index) => ({
    level: (index + 1) as 1 | 2 | 3 | 4 | 5,
    name: name as 'mouse' | 'rabbit' | 'fox' | 'wolf' | 'bear',
    locked: false,
    wins: 0,
    games: 0,
  }));

  function winsAndLosses(level: number, results: readonly ('win' | 'loss')[]): GameRecord[] {
    return results.map((result, index) =>
      record({
        id: `g${String(index)}`,
        result,
        opponent: `computer:${String(level)}`,
        createdAt: `2026-01-01T00:0${String(index)}:00.000Z`,
      }),
    );
  }

  it('saves the update to AppSettings.suggestedLevels, keyed by profile', async () => {
    const deps = makeDeps();
    const records = winsAndLosses(2, ['win', 'win', 'win', 'win', 'win']);

    const update = await updateSuggestedLevel(deps, 'profile-1', 2, records, STATUSES);

    expect(update).toEqual({ level: 3, leveledUp: true });
    expect(await deps.settings.get()).toMatchObject({ suggestedLevels: { 'profile-1': 3 } });
  });

  it('returns null and does not touch settings when nothing changes', async () => {
    const deps = makeDeps();
    const records = winsAndLosses(2, ['win', 'loss', 'win', 'loss', 'win']);

    const update = await updateSuggestedLevel(deps, 'profile-1', 2, records, STATUSES);

    expect(update).toBeNull();
    expect(await deps.settings.get()).toMatchObject({ suggestedLevels: {} });
  });

  it('keeps other profiles’ suggestions when saving one', async () => {
    const deps = makeDeps();
    await deps.settings.save({
      lastProfileId: null,
      suggestedLevels: { 'profile-other': 4 },
      profileSettings: {},
    });
    const records = winsAndLosses(2, ['loss', 'loss', 'loss', 'loss', 'loss']);

    await updateSuggestedLevel(deps, 'profile-1', 2, records, STATUSES);

    expect(await deps.settings.get()).toMatchObject({
      suggestedLevels: { 'profile-other': 4, 'profile-1': 1 },
    });
  });
});
