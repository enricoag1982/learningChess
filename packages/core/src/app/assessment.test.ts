import { describe, expect, it } from 'vitest';

import type { AssessmentResult, AssessmentScope, Unlock } from '../domain/assessment.ts';
import { scorePlacementWorld, scoreTestOut } from '../domain/assessment.ts';
import type { ExerciseDef } from '../domain/exercise/types.ts';
import type { Track, TracksCatalog, World } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import type { Attempt, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import { seededRandom } from '../domain/random.ts';
import type { ConceptStats } from '../domain/review.ts';
import { loadUnlocked, parentUnlock, submitAssessment } from './assessment.ts';
import { loadJourney } from './journey.ts';
import type {
  AppSettings,
  AssessmentRepository,
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
import type { AppDeps } from './use-cases.ts';

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

function makeLesson(
  id: string,
  world: string,
  order: number,
  overrides: Partial<Lesson> = {},
): Lesson {
  return {
    id,
    world,
    order,
    concept: `${id}-concept`,
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [
      makeExercise(`${id}-01`, `${id}-concept`),
      makeExercise(`${id}-02`, `${id}-concept`),
    ],
    ...overrides,
  };
}

// w1 (no boss): lessons l1, l2. w2 (has boss "w2-boss"): lesson l3.
const W1: World = { id: 'w1', track: 'basics', order: 1, habitat: 'meadow', titleKey: 'w1' };
const W2: World = {
  id: 'w2',
  track: 'basics',
  order: 2,
  habitat: 'savannah',
  titleKey: 'w2',
  boss: 'w2-boss',
};
const BASICS: Track = { id: 'basics', kind: 'main', titleKey: 'basics', worlds: [W1, W2] };
const CATALOG: TracksCatalog = { tracks: [BASICS], ranks: [] };

const L1 = makeLesson('l1', 'w1', 1);
const L2 = makeLesson('l2', 'w1', 2);
const L3 = makeLesson('l3', 'w2', 1, { boss: 'l3-boss' });
const LESSONS = [L1, L2, L3];

function makeContent(): ContentSource {
  return {
    lessons: () => LESSONS,
    lesson: (id) => LESSONS.find((lesson) => lesson.id === id),
    minigames: () => [],
    minigame: () => undefined,
    catalog: () => CATALOG,
  };
}

function makeProgressRepo(): ProgressRepository {
  const lessons = new Map<string, LessonProgress>();
  const attempts: Attempt[] = [];
  const minigames = new Map<string, MiniGameProgress>();
  const conceptStats = new Map<string, ConceptStats>();
  const key = (profileId: string, id: string): string => `${profileId}:${id}`;
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
    getConceptStats: (profileId, conceptId) =>
      Promise.resolve(conceptStats.get(key(profileId, conceptId))),
    listConceptStats: (profileId) =>
      Promise.resolve([...conceptStats.values()].filter((s) => s.profileId === profileId)),
    saveConceptStats: (stats) => {
      conceptStats.set(key(stats.profileId, stats.conceptId), stats);
      return Promise.resolve();
    },
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeAssessmentRepo(): AssessmentRepository {
  const results: AssessmentResult[] = [];
  const unlocks: Unlock[] = [];
  return {
    addAssessmentResult: (result) => {
      results.push(result);
      return Promise.resolve();
    },
    listAssessmentResults: (profileId) =>
      Promise.resolve(results.filter((r) => r.profileId === profileId)),
    addUnlock: (unlock) => {
      unlocks.push(unlock);
      return Promise.resolve();
    },
    listUnlocks: (profileId) => Promise.resolve(unlocks.filter((u) => u.profileId === profileId)),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeGameRecordRepo(): GameRecordRepository {
  return {
    add: () => Promise.resolve(),
    listByProfile: () => Promise.resolve([]),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeProfileRepo(): ProfileRepository {
  return {
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    save: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  };
}

function makeParentLockRepo(): ParentLockRepository {
  return { get: () => Promise.resolve(undefined), save: () => Promise.resolve() };
}

function makePasswordFileWriter(): PasswordFileWriter {
  return { write: () => Promise.resolve({ location: 'fake.txt' }) };
}

function makeSettingsRepo(): SettingsRepository {
  let settings: AppSettings = { lastProfileId: null, suggestedLevels: {} };
  return {
    get: () => Promise.resolve(settings),
    save: (next) => {
      settings = next;
      return Promise.resolve();
    },
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

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    gameRecords: makeGameRecordRepo(),
    assessment: makeAssessmentRepo(),
    clock: makeClock('2026-01-01T00:00:00.000Z'),
    ids: makeIds(),
    content: makeContent(),
    parentLock: makeParentLockRepo(),
    passwordFile: makePasswordFileWriter(),
    settings: makeSettingsRepo(),
    random: seededRandom(1),
    ...overrides,
  };
}

describe('submitAssessment', () => {
  it('records the AssessmentResult on a fail, and changes nothing else', async () => {
    const deps = makeDeps();
    const scope: AssessmentScope = { type: 'lesson', lessonId: 'l1', worldId: 'w1' };
    const score = scoreTestOut([true, true, false, false, false]);

    const outcome = await submitAssessment(deps, {
      profileId: 'p1',
      kind: 'test-out',
      scope,
      results: [true, true, false, false, false],
      score,
    });

    expect(outcome.passed).toBe(false);
    const results = await deps.assessment?.listAssessmentResults('p1');
    expect(results).toHaveLength(1);
    expect(results?.[0]).toMatchObject({ passed: false, correct: 2, total: 5 });

    const progress = await deps.progress.getLesson('p1', 'l1');
    expect(progress).toBeUndefined();
    const unlocked = await loadUnlocked(deps, 'p1');
    expect(unlocked?.size).toBe(0);
  });

  it('on a lesson-scope pass: masters the lesson, floors stars to 1, enters review, unlocks it', async () => {
    const deps = makeDeps();
    const scope: AssessmentScope = { type: 'lesson', lessonId: 'l1', worldId: 'w1' };
    const score = scoreTestOut([true, true, true, true, false]);

    await submitAssessment(deps, {
      profileId: 'p1',
      kind: 'test-out',
      scope,
      results: [true, true, true, true, false],
      score,
    });

    const progress = await deps.progress.getLesson('p1', 'l1');
    expect(progress?.masteredVia).toBe('test-out');
    expect(progress?.bestStars).toEqual({ 'l1-01': 1, 'l1-02': 1 });

    const stats = await deps.progress.getConceptStats('p1', 'l1-concept');
    expect(stats?.box).toBe(1);
    // "due tomorrow", not immediately.
    expect(stats?.dueAt).not.toBe(deps.clock.now().toISOString());

    const unlocked = await loadUnlocked(deps, 'p1');
    expect(unlocked?.has('l1')).toBe(true);
  });

  it('never lowers an existing higher star', async () => {
    const deps = makeDeps();
    const progressRepo = deps.progress;
    await progressRepo.saveLesson({
      id: 'lp-1',
      profileId: 'p1',
      lessonId: 'l1',
      bestStars: { 'l1-01': 3 },
      bossStars: 0,
      resumeStep: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    await submitAssessment(deps, {
      profileId: 'p1',
      kind: 'test-out',
      scope: { type: 'lesson', lessonId: 'l1', worldId: 'w1' },
      results: [true, true, true, true, false],
      score: scoreTestOut([true, true, true, true, false]),
    });

    const progress = await progressRepo.getLesson('p1', 'l1');
    expect(progress?.bestStars).toEqual({ 'l1-01': 3, 'l1-02': 1 });
  });

  it('on a world-scope pass for a boss-having world: masters every lesson, world counts as mastered for gating even with the boss unwon, but the boss itself stays available', async () => {
    const deps = makeDeps();
    const score = scorePlacementWorld([true, true, true, true]);

    await submitAssessment(deps, {
      profileId: 'p1',
      kind: 'test-out',
      scope: { type: 'world', worldId: 'w2' },
      results: [true, true, true, true],
      score,
    });

    const progress = await deps.progress.getLesson('p1', 'l3');
    expect(progress?.masteredVia).toBe('test-out');

    const journey = await loadJourney(deps, 'p1');
    const w2 = journey.worlds.find((entry) => entry.world.id === 'w2');
    // The boss was never played, so the world's own display status stays "available" (the crown
    // shouldn't claim a win that never happened) — domain-model.md §3.2's own wording.
    expect(w2?.status).toBe('available');
    expect(w2?.bossStatus).toBe('available');
  });

  it('placement (per-world pass) applies the same effect with masteredVia "placement"', async () => {
    const deps = makeDeps();
    await submitAssessment(deps, {
      profileId: 'p1',
      kind: 'placement',
      scope: { type: 'world', worldId: 'w1' },
      results: [true, true, true, false],
      score: scorePlacementWorld([true, true, true, false]),
    });

    const l1Progress = await deps.progress.getLesson('p1', 'l1');
    const l2Progress = await deps.progress.getLesson('p1', 'l2');
    expect(l1Progress?.masteredVia).toBe('placement');
    expect(l2Progress?.masteredVia).toBe('placement');

    // World 1 has no boss, so it is naturally, fully mastered now.
    const journey = await loadJourney(deps, 'p1');
    const w1 = journey.worlds.find((entry) => entry.world.id === 'w1');
    expect(w1?.status).toBe('mastered');
  });
});

describe('parentUnlock', () => {
  it('unlocks a single lesson directly, masteredVia "parent", no star floor', async () => {
    const deps = makeDeps();
    await parentUnlock(deps, 'p1', { type: 'lesson', lessonId: 'l1' });

    const progress = await deps.progress.getLesson('p1', 'l1');
    expect(progress?.masteredVia).toBe('parent');
    expect(progress?.bestStars).toEqual({});

    const unlocked = await loadUnlocked(deps, 'p1');
    expect(unlocked?.has('l1')).toBe(true);
  });

  it('unlocks a whole world directly: every lesson in it, and the world id', async () => {
    const deps = makeDeps();
    await parentUnlock(deps, 'p1', { type: 'world', worldId: 'w1' });

    const l1 = await deps.progress.getLesson('p1', 'l1');
    const l2 = await deps.progress.getLesson('p1', 'l2');
    expect(l1?.masteredVia).toBe('parent');
    expect(l2?.masteredVia).toBe('parent');

    const unlocked = await loadUnlocked(deps, 'p1');
    expect(unlocked?.has('w1')).toBe(true);
  });
});

describe('loadUnlocked', () => {
  it('is undefined without deps.assessment wired up (pre-M4.5 fixtures)', async () => {
    const deps = makeDeps({ assessment: undefined });
    expect(await loadUnlocked(deps, 'p1')).toBeUndefined();
  });
});
