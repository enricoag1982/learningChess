import { describe, expect, it } from 'vitest';

import type { CaptureDef } from '../domain/exercise/types.ts';
import type { ExerciseState } from '../domain/exercise/engine.ts';
import type { GameState } from '../domain/exercise/minigame.ts';
import type { MiniGame } from '../domain/lesson.ts';
import type { Attempt, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
import type { Profile } from '../domain/profile.ts';
import { loadMiniGameProgress, recordMiniGameResult } from './minigames.ts';
import type { AppDeps } from './use-cases.ts';
import type {
  AppSettings,
  Clock,
  ContentSource,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  SettingsRepository,
} from './ports.ts';

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

function exerciseState(def: CaptureDef, overrides: Partial<ExerciseState> = {}): ExerciseState {
  return {
    def,
    position: def.position,
    history: [],
    moves: 0,
    selected: [],
    errors: 0,
    hintLevel: 0,
    solved: false,
    ...overrides,
  };
}

const CAPTURE_DEF: CaptureDef = {
  id: 'hungry-rook',
  concept: 'rook-move',
  textKey: 'hungry-rook',
  position: EMPTY_POSITION,
  type: 'capture',
  stars3: 2,
  stars2: 2,
};

function gameState(overrides: Partial<GameState> = {}): GameState {
  const def = { id: 'hungry-rook', concept: 'rook-move', position: EMPTY_POSITION, par: 2 };
  return {
    mode: 'static',
    def,
    exercise: exerciseState(CAPTURE_DEF),
    ended: false,
    ...overrides,
  };
}

/** A won game (solved within `par`): `gameStars` = 3. */
function wonGame(): GameState {
  return gameState({ exercise: exerciseState(CAPTURE_DEF, { solved: true, moves: 2 }) });
}

function makeIds(prefix = 'id'): IdGenerator {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return `${prefix}-${String(count)}`;
    },
  };
}

function makeClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

function makeProgressRepo(): ProgressRepository {
  const attempts: Attempt[] = [];
  const minigames = new Map<string, MiniGameProgress>();
  const key = (profileId: string, miniGameId: string): string => `${profileId}:${miniGameId}`;
  return {
    listLessons: () => Promise.resolve<LessonProgress[]>([]),
    getLesson: () => Promise.resolve(undefined),
    saveLesson: () => Promise.resolve(),
    addAttempt: (attempt) => {
      attempts.push(attempt);
      return Promise.resolve();
    },
    listAttempts: (profileId) => Promise.resolve(attempts.filter((a) => a.profileId === profileId)),
    getMiniGame: (profileId, miniGameId) =>
      Promise.resolve(minigames.get(key(profileId, miniGameId))),
    listMiniGames: (profileId) =>
      Promise.resolve([...minigames.values()].filter((p) => p.profileId === profileId)),
    saveMiniGame: (progress) => {
      minigames.set(key(progress.profileId, progress.miniGameId), progress);
      return Promise.resolve();
    },
    deleteProfileData: () => Promise.resolve(),
  };
}

const stubContent: ContentSource = {
  lessons: () => [],
  lesson: () => undefined,
  minigames: () => [],
  minigame: () => undefined,
};

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: {
      list: () => Promise.resolve<Profile[]>([]),
      get: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    } satisfies ProfileRepository,
    progress: makeProgressRepo(),
    clock: makeClock('2026-01-01T00:00:00.000Z'),
    ids: makeIds(),
    content: stubContent,
    parentLock: {
      get: () => Promise.resolve<ParentLock | undefined>(undefined),
      save: () => Promise.resolve(),
    } satisfies ParentLockRepository,
    passwordFile: {
      write: (password) => Promise.resolve({ location: `fake/${password}.txt` }),
    } satisfies PasswordFileWriter,
    settings: {
      get: () => Promise.resolve<AppSettings>({ lastProfileId: null }),
      save: () => Promise.resolve(),
    } satisfies SettingsRepository,
    ...overrides,
  };
}

const HUNGRY_ROOK: MiniGame = {
  mode: 'static',
  id: 'hungry-rook',
  concept: 'rook-move',
  position: EMPTY_POSITION,
  par: 2,
  titleKey: 'fixtures:title',
  goalKey: 'fixtures:goal',
  unlockAfter: 'rook',
};

describe('recordMiniGameResult', () => {
  it('saves an unscored attempt and starts fresh MiniGameProgress on the first play', async () => {
    const deps = makeDeps();

    const progress = await recordMiniGameResult(deps, {
      profileId: 'profile-1',
      game: HUNGRY_ROOK,
      state: wonGame(),
      durationMs: 1500,
    });

    expect(progress).toMatchObject({
      profileId: 'profile-1',
      miniGameId: 'hungry-rook',
      bestStars: 3,
      plays: 1,
      wins: 1,
    });

    const [attempt] = await deps.progress.listAttempts('profile-1');
    expect(attempt).toMatchObject({
      lessonId: 'rook',
      exerciseId: 'hungry-rook',
      conceptId: 'rook-move',
      scored: false,
      correct: true,
      stars: 3,
      durationMs: 1500,
    });
  });

  it('keeps the best stars across two plays and always bumps plays', async () => {
    const deps = makeDeps();

    await recordMiniGameResult(deps, {
      profileId: 'profile-1',
      game: HUNGRY_ROOK,
      state: wonGame(),
      durationMs: 1000,
    });
    const second = await recordMiniGameResult(deps, {
      profileId: 'profile-1',
      game: HUNGRY_ROOK,
      state: gameState({ ended: true }),
      durationMs: 1000,
    });

    expect(second).toMatchObject({ bestStars: 3, plays: 2, wins: 1 });
  });
});

describe('loadMiniGameProgress', () => {
  it('delegates to the repository', async () => {
    const deps = makeDeps();
    await recordMiniGameResult(deps, {
      profileId: 'profile-1',
      game: HUNGRY_ROOK,
      state: gameState({ ended: true }),
      durationMs: 500,
    });

    expect(await loadMiniGameProgress(deps, 'profile-1')).toHaveLength(1);
    expect(await loadMiniGameProgress(deps, 'someone-else')).toEqual([]);
  });
});
