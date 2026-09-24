import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../domain/chess/chessjs-rules.ts';
import type { ExerciseState } from '../domain/exercise/engine.ts';
import { starsFor } from '../domain/exercise/engine.ts';
import type { GameState, SeriesGameState } from '../domain/exercise/minigame.ts';
import { gameStars, seriesStars } from '../domain/exercise/minigame.ts';
import type { ExerciseDef, CaptureDef } from '../domain/exercise/types.ts';
import { playVersusMove, startVersus, versusStars } from '../domain/exercise/versus.ts';
import type { VersusGameDef } from '../domain/exercise/versus.ts';
import type { GameRulesDef } from '../domain/game/types.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { AppDeps } from './use-cases.ts';
import {
  getLessonProgress,
  loadProgress,
  recordBossResult,
  recordExerciseResult,
  saveResumeStep,
} from './use-cases.ts';
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

function makeExercise(id: string, overrides: Partial<ExerciseDef> = {}): ExerciseDef {
  return {
    id,
    concept: 'rook-move',
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
    ...overrides,
  } as ExerciseDef;
}

const GUIDED_1 = makeExercise('rook-g1');
const EXERCISE_1 = makeExercise('rook-01');
const EXERCISE_2 = makeExercise('rook-02');

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
    guided: [GUIDED_1],
    exercises: [EXERCISE_1, EXERCISE_2],
    ...overrides,
  };
}

function exerciseState(def: ExerciseDef, overrides: Partial<ExerciseState> = {}): ExerciseState {
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

function gameState(id: string, overrides: Partial<GameState> = {}): GameState {
  const def = { id, concept: 'rook-move', position: EMPTY_POSITION, par: 2 };
  const captureDef: CaptureDef = {
    id,
    concept: 'rook-move',
    textKey: id,
    position: EMPTY_POSITION,
    type: 'capture',
    stars3: 2,
    stars2: 2,
  };
  return {
    mode: 'static',
    def,
    exercise: exerciseState(captureDef),
    ended: false,
    ...overrides,
  };
}

function seriesGameState(id: string, overrides: Partial<SeriesGameState> = {}): SeriesGameState {
  const round1: ExerciseDef = makeExercise(`${id}-r1`);
  const round2: ExerciseDef = makeExercise(`${id}-r2`);
  const def = { id, concept: 'rook-move', rounds: [round1, round2], errors3: 1, errors2: 3 };
  return {
    mode: 'series',
    def,
    roundIndex: 0,
    round: exerciseState(round1),
    mistakes: 0,
    done: false,
    ...overrides,
  };
}

function makeClock(iso: string): Clock {
  return { now: () => new Date(iso) };
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

function makeProfileRepo(initial: readonly Profile[] = []): ProfileRepository {
  const store = new Map(initial.map((profile) => [profile.id, profile]));
  return {
    list: () =>
      Promise.resolve([...store.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
    get: (id) => Promise.resolve(store.get(id)),
    save: (profile) => {
      store.set(profile.id, profile);
      return Promise.resolve();
    },
    delete: (id) => {
      store.delete(id);
      return Promise.resolve();
    },
  };
}

function makeProgressRepo(): ProgressRepository {
  const lessons = new Map<string, LessonProgress>();
  const attempts: Attempt[] = [];
  const minigames = new Map<string, MiniGameProgress>();
  const key = (profileId: string, lessonId: string): string => `${profileId}:${lessonId}`;
  return {
    listLessons: (profileId) =>
      Promise.resolve([...lessons.values()].filter((p) => p.profileId === profileId)),
    getLesson: (profileId, lessonId) => Promise.resolve(lessons.get(key(profileId, lessonId))),
    saveLesson: (progress) => {
      lessons.set(key(progress.profileId, progress.lessonId), progress);
      return Promise.resolve();
    },
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
    deleteProfileData: (profileId) => {
      for (const [k, progress] of lessons) {
        if (progress.profileId === profileId) lessons.delete(k);
      }
      return Promise.resolve();
    },
  };
}

function makeParentLockRepo(): ParentLockRepository {
  let lock: ParentLock | undefined;
  return {
    get: () => Promise.resolve(lock),
    save: (next) => {
      lock = next;
      return Promise.resolve();
    },
  };
}

function makePasswordFileWriter(): PasswordFileWriter {
  return { write: (password) => Promise.resolve({ location: `fake/${password}.txt` }) };
}

function makeSettingsRepo(): SettingsRepository {
  let settings: AppSettings = { lastProfileId: null };
  return {
    get: () => Promise.resolve(settings),
    save: (next) => {
      settings = next;
      return Promise.resolve();
    },
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
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    clock: makeClock('2026-01-01T00:00:00.000Z'),
    ids: makeIds(),
    content: stubContent,
    parentLock: makeParentLockRepo(),
    passwordFile: makePasswordFileWriter(),
    settings: makeSettingsRepo(),
    ...overrides,
  };
}

describe('getLessonProgress', () => {
  it('returns fresh, unsaved progress when none exists', async () => {
    const deps = makeDeps();

    const progress = await getLessonProgress(deps, 'profile-1', 'rook');

    expect(progress.profileId).toBe('profile-1');
    expect(progress.lessonId).toBe('rook');
    expect(progress.bestStars).toEqual({});
    expect(progress.resumeStep).toBe(0);
    expect(await deps.progress.listLessons('profile-1')).toEqual([]);
  });

  it('returns the stored progress once something has saved it', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();
    const state = exerciseState(EXERCISE_1, { solved: true, moves: 1 });

    await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      scored: true,
      durationMs: 1000,
      nextStep: 3,
    });

    const progress = await getLessonProgress(deps, 'profile-1', 'rook');
    expect(progress.resumeStep).toBe(3);
  });
});

describe('loadProgress', () => {
  it('delegates to the repository', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();
    await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state: exerciseState(EXERCISE_1, { solved: true, moves: 1 }),
      scored: true,
      durationMs: 500,
      nextStep: 1,
    });

    expect(await loadProgress(deps, 'profile-1')).toHaveLength(1);
    expect(await loadProgress(deps, 'someone-else')).toEqual([]);
  });
});

describe('recordExerciseResult', () => {
  it('for a guided try (scored=false): records the attempt but never updates bestStars', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();
    const state = exerciseState(GUIDED_1, { solved: true, moves: 1, errors: 0, hintLevel: 0 });

    const progress = await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      scored: false,
      durationMs: 2000,
      nextStep: 2,
    });

    expect(progress.bestStars).toEqual({});
    expect(progress.resumeStep).toBe(2);

    const attempts = await deps.progress.listAttempts('profile-1');
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      profileId: 'profile-1',
      lessonId: 'rook',
      exerciseId: 'rook-g1',
      conceptId: 'rook-move',
      scored: false,
      correct: true,
      stars: starsFor(state),
      hints: 0,
      errors: 0,
      moves: 1,
      durationMs: 2000,
    });
  });

  it('for a scored, solved exercise: raises bestStars and advances resumeStep', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();
    const state = exerciseState(EXERCISE_1, { solved: true, moves: 1 }); // stars3 = 1 → 3 stars

    const progress = await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      scored: true,
      durationMs: 3000,
      nextStep: 4,
    });

    expect(progress.bestStars).toEqual({ 'rook-01': 3 });
    expect(progress.resumeStep).toBe(4);
  });

  it('for a scored but unsolved (illegal) attempt: records the attempt, never touches bestStars', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();
    const state = exerciseState(EXERCISE_1, { solved: false, errors: 1 });

    const progress = await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      scored: true,
      durationMs: 500,
      nextStep: 1,
    });

    expect(progress.bestStars).toEqual({});
    const attempts = await deps.progress.listAttempts('profile-1');
    expect(attempts[0]).toMatchObject({ correct: false, stars: 0, errors: 1 });
  });

  it('attempt.correct is true only when solved with zero errors and zero hints', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();
    const withHint = exerciseState(EXERCISE_1, {
      solved: true,
      moves: 1,
      hintLevel: 1,
    });

    await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state: withHint,
      scored: true,
      durationMs: 100,
      nextStep: 1,
    });

    const [attempt] = await deps.progress.listAttempts('profile-1');
    expect(attempt?.correct).toBe(false);
    expect(attempt?.hints).toBe(1);
  });

  it('keeps the previous best when a later attempt scores lower', async () => {
    const deps = makeDeps();
    const lesson = makeLesson();

    await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state: exerciseState(EXERCISE_1, { solved: true, moves: 1 }), // 3 stars
      scored: true,
      durationMs: 100,
      nextStep: 1,
    });
    const second = await recordExerciseResult(deps, {
      profileId: 'profile-1',
      lesson,
      state: exerciseState(EXERCISE_1, { solved: true, moves: 2, hintLevel: 1 }), // capped to 2
      scored: true,
      durationMs: 100,
      nextStep: 2,
    });

    expect(second.bestStars).toEqual({ 'rook-01': 3 });
  });
});

describe('recordBossResult', () => {
  it('records a scored attempt and raises bossStars', async () => {
    const deps = makeDeps();
    const lesson = makeLesson({ boss: 'hungry-rook' });
    const state = gameState('hungry-rook', {
      exercise: exerciseState(
        {
          id: 'hungry-rook',
          concept: 'rook-move',
          textKey: 'hungry-rook',
          position: EMPTY_POSITION,
          type: 'capture',
          stars3: 2,
          stars2: 2,
        },
        { solved: true, moves: 2 },
      ),
    });
    expect(gameStars(state)).toBe(3);

    const progress = await recordBossResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      durationMs: 4000,
      nextStep: 8,
    });

    expect(progress.bossStars).toBe(3);
    expect(progress.resumeStep).toBe(8);

    const [attempt] = await deps.progress.listAttempts('profile-1');
    expect(attempt).toMatchObject({
      exerciseId: 'hungry-rook',
      conceptId: 'rook-move',
      scored: true,
      correct: true,
      stars: 3,
      moves: 2,
      durationMs: 4000,
    });
  });

  it('records a series boss attempt (total mistakes across rounds), raising bossStars', async () => {
    const deps = makeDeps();
    const lesson = makeLesson({ boss: 'square-hunt' });
    const state = seriesGameState('square-hunt', {
      roundIndex: 1,
      mistakes: 1,
      done: true,
      round: exerciseState(makeExercise('square-hunt-r2'), { solved: true }),
    });
    expect(seriesStars(state)).toBe(3);

    const progress = await recordBossResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      durationMs: 9000,
      nextStep: 8,
    });

    expect(progress.bossStars).toBe(3);
    expect(progress.resumeStep).toBe(8);

    const [attempt] = await deps.progress.listAttempts('profile-1');
    expect(attempt).toMatchObject({
      exerciseId: 'square-hunt',
      conceptId: 'rook-move',
      scored: true,
      correct: false,
      stars: 3,
      errors: 1,
      moves: 2,
      durationMs: 9000,
    });
  });

  it('records a won versus boss attempt (win within par), raising bossStars', async () => {
    const deps = makeDeps();
    const lesson = makeLesson({ boss: 'pawn-wars-4' });
    const rules: GameRulesDef = {
      kings: false,
      checkRules: false,
      noMoves: 'lose',
      win: {
        w: [{ kind: 'promote' }, { kind: 'capture-all' }],
        b: [{ kind: 'promote' }, { kind: 'capture-all' }],
      },
    };
    const def: VersusGameDef = {
      id: 'pawn-wars-4',
      concept: 'pawn-move',
      rules,
      position: {
        pieces: {
          a7: { color: 'w', type: 'p' },
          h7: { color: 'b', type: 'p' },
        },
        markers: { stars: [], blocked: [] },
        toMove: 'w',
        castling: '-',
        enPassant: null,
      },
      opponentLevel: 1,
      kidColor: 'w',
      par: 1,
    };
    const { state } = playVersusMove(startVersus(def), chessJsRules, { from: 'a7', to: 'a8' });
    expect(versusStars(state)).toBe(3);

    const progress = await recordBossResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      durationMs: 5000,
      nextStep: 9,
    });

    expect(progress.bossStars).toBe(3);
    expect(progress.resumeStep).toBe(9);

    const [attempt] = await deps.progress.listAttempts('profile-1');
    expect(attempt).toMatchObject({
      exerciseId: 'pawn-wars-4',
      conceptId: 'pawn-move',
      scored: true,
      correct: true,
      stars: 3,
      hints: 0,
      errors: 0,
      moves: 1,
      durationMs: 5000,
    });
  });

  it('records a lost versus boss attempt as 1 star, not correct', async () => {
    const deps = makeDeps();
    const lesson = makeLesson({ boss: 'pawn-wars-4' });
    const rules: GameRulesDef = {
      kings: false,
      checkRules: false,
      noMoves: 'lose',
      win: {
        w: [{ kind: 'promote' }, { kind: 'capture-all' }],
        b: [{ kind: 'promote' }, { kind: 'capture-all' }],
      },
    };
    const def: VersusGameDef = {
      id: 'pawn-wars-4',
      concept: 'pawn-move',
      rules,
      position: {
        pieces: {
          h2: { color: 'b', type: 'p' },
          a2: { color: 'w', type: 'p' },
        },
        markers: { stars: [], blocked: [] },
        toMove: 'b',
        castling: '-',
        enPassant: null,
      },
      opponentLevel: 1,
      kidColor: 'w',
    };
    const { state } = playVersusMove(startVersus(def), chessJsRules, { from: 'h2', to: 'h1' });
    expect(state.status).toBe('lost');

    const progress = await recordBossResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      durationMs: 3000,
      nextStep: 9,
    });

    expect(progress.bossStars).toBe(1);
    const [attempt] = await deps.progress.listAttempts('profile-1');
    expect(attempt).toMatchObject({ correct: false, stars: 1, moves: 0 });
  });

  it("also folds the play into that mini-game's own MiniGameProgress, for the Play tile", async () => {
    const hungryRook: MiniGame = {
      mode: 'static',
      id: 'hungry-rook',
      concept: 'rook-move',
      position: EMPTY_POSITION,
      par: 2,
      titleKey: 'fixtures:title',
      goalKey: 'fixtures:goal',
      unlockAfter: 'rook',
    };
    const deps = makeDeps({
      content: {
        ...stubContent,
        minigame: (id) => (id === 'hungry-rook' ? hungryRook : undefined),
      },
    });
    const lesson = makeLesson({ boss: 'hungry-rook' });
    const state = gameState('hungry-rook', {
      exercise: exerciseState(
        {
          id: 'hungry-rook',
          concept: 'rook-move',
          textKey: 'hungry-rook',
          position: EMPTY_POSITION,
          type: 'capture',
          stars3: 2,
          stars2: 2,
        },
        { solved: true, moves: 2 },
      ),
    });

    await recordBossResult(deps, {
      profileId: 'profile-1',
      lesson,
      state,
      durationMs: 4000,
      nextStep: 8,
    });

    const miniGameProgress = await deps.progress.getMiniGame('profile-1', 'hungry-rook');
    expect(miniGameProgress).toMatchObject({ bestStars: 3, plays: 1, wins: 1 });

    const attempts = await deps.progress.listAttempts('profile-1');
    // Exactly one attempt per play: the lesson's own boss attempt (no duplicate for the tile).
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ scored: true, exerciseId: 'hungry-rook' });
  });
});

describe('saveResumeStep', () => {
  it('moves the resume point without recording an attempt', async () => {
    const deps = makeDeps();

    const progress = await saveResumeStep(deps, 'profile-1', 'rook', 5);

    expect(progress.resumeStep).toBe(5);
    expect(await deps.progress.listAttempts('profile-1')).toEqual([]);
    expect(await deps.progress.listLessons('profile-1')).toEqual([progress]);
  });
});
