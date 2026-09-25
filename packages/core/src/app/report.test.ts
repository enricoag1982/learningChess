import { describe, expect, it } from 'vitest';

import type { AssessmentResult } from '../domain/assessment.ts';
import type { EarnedBadge } from '../domain/badges.ts';
import type { ExerciseDef } from '../domain/exercise/types.ts';
import type { Track, TracksCatalog, World } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import type { Profile } from '../domain/profile.ts';
import { newProfile } from '../domain/profile.ts';
import { DEFAULT_PROFILE_SETTINGS } from '../domain/profile-settings.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import { seededRandom } from '../domain/random.ts';
import type { ConceptStats } from '../domain/review.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import { buildChildOverview, buildChildReport } from './report.ts';
import type {
  AppSettings,
  AssessmentRepository,
  ContentSource,
  GameRecordRepository,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  RewardsRepository,
} from './ports.ts';
import type { AppDeps } from './use-cases.ts';

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

const NOW = new Date('2026-01-10T12:00:00.000Z');

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

function makeLesson(id: string, world: string, order: number, concept = `${id}-concept`): Lesson {
  return {
    id,
    world,
    order,
    concept,
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [makeExercise(`${id}-01`, concept), makeExercise(`${id}-02`, concept)],
  };
}

// w1: lessons l1, l2 (2 exercises each, 3-star max 6 each).
const W1: World = { id: 'w1', track: 'basics', order: 1, habitat: 'meadow', titleKey: 'w1' };
const BASICS: Track = { id: 'basics', kind: 'main', titleKey: 'basics', worlds: [W1] };
const CATALOG: TracksCatalog = { tracks: [BASICS], ranks: [] };

const L1 = makeLesson('l1', 'w1', 1, 'concept-a');
const L2 = makeLesson('l2', 'w1', 2, 'concept-b');
const LESSONS = [L1, L2];

function makeContent(): ContentSource {
  return {
    lessons: () => LESSONS,
    lesson: (id) => LESSONS.find((lesson) => lesson.id === id),
    minigames: () => [],
    minigame: () => undefined,
    catalog: () => CATALOG,
  };
}

function makeProfileRepo(initial: readonly Profile[] = []): ProfileRepository {
  const store = new Map(initial.map((profile) => [profile.id, profile]));
  return {
    list: () => Promise.resolve([...store.values()]),
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

function makeProgressRepo(
  initialLessons: readonly LessonProgress[] = [],
  initialConceptStats: readonly ConceptStats[] = [],
): ProgressRepository {
  const lessons = new Map(initialLessons.map((p) => [`${p.profileId}:${p.lessonId}`, p]));
  const conceptStats = new Map(
    initialConceptStats.map((s) => [`${s.profileId}:${s.conceptId}`, s]),
  );
  return {
    listLessons: (profileId) =>
      Promise.resolve([...lessons.values()].filter((p) => p.profileId === profileId)),
    getLesson: (profileId, lessonId) => Promise.resolve(lessons.get(`${profileId}:${lessonId}`)),
    saveLesson: (progress) => {
      lessons.set(`${progress.profileId}:${progress.lessonId}`, progress);
      return Promise.resolve();
    },
    addAttempt: () => Promise.resolve(),
    listAttempts: () => Promise.resolve<Attempt[]>([]),
    getMiniGame: () => Promise.resolve(undefined),
    listMiniGames: () => Promise.resolve<MiniGameProgress[]>([]),
    saveMiniGame: () => Promise.resolve(),
    getConceptStats: (profileId, conceptId) =>
      Promise.resolve(conceptStats.get(`${profileId}:${conceptId}`)),
    listConceptStats: (profileId) =>
      Promise.resolve([...conceptStats.values()].filter((s) => s.profileId === profileId)),
    saveConceptStats: () => Promise.resolve(),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeGameRecordRepo(initial: readonly GameRecord[] = []): GameRecordRepository {
  const records = [...initial];
  return {
    add: (record) => {
      records.push(record);
      return Promise.resolve();
    },
    listByProfile: (profileId) =>
      Promise.resolve(records.filter((record) => record.profileId === profileId)),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeRewardsRepo(
  options: {
    readonly badges?: readonly EarnedBadge[];
    readonly streak?: Streak;
    readonly sessionLogs?: readonly SessionLog[];
  } = {},
): RewardsRepository {
  const badges = options.badges ?? [];
  const logs = options.sessionLogs ?? [];
  return {
    addEarnedBadge: () => Promise.resolve(),
    listEarnedBadges: (profileId) =>
      Promise.resolve(badges.filter((b) => b.profileId === profileId)),
    saveEarnedBadge: () => Promise.resolve(),
    getStreak: (profileId) =>
      Promise.resolve(options.streak?.profileId === profileId ? options.streak : undefined),
    saveStreak: () => Promise.resolve(),
    getSessionLog: () => Promise.resolve(undefined),
    saveSessionLog: () => Promise.resolve(),
    listSessionLogs: (profileId) =>
      Promise.resolve(logs.filter((log) => log.profileId === profileId)),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeAssessmentRepo(results: readonly AssessmentResult[] = []): AssessmentRepository {
  return {
    addAssessmentResult: () => Promise.resolve(),
    listAssessmentResults: (profileId) =>
      Promise.resolve(results.filter((r) => r.profileId === profileId)),
    addUnlock: () => Promise.resolve(),
    listUnlocks: () => Promise.resolve([]),
    deleteProfileData: () => Promise.resolve(),
  };
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
    rewards: makeRewardsRepo(),
    assessment: makeAssessmentRepo(),
    clock: { now: () => NOW },
    ids: makeIds(),
    content: makeContent(),
    parentLock: {} as unknown as ParentLockRepository,
    passwordFile: {} as unknown as PasswordFileWriter,
    settings: {
      get: () =>
        Promise.resolve<AppSettings>({
          lastProfileId: null,
          suggestedLevels: {},
          profileSettings: {},
        }),
      save: () => Promise.resolve(),
    },
    random: seededRandom(1),
    ...overrides,
  };
}

function makeConceptStats(
  profileId: string,
  conceptId: string,
  recent: readonly boolean[],
): ConceptStats {
  return {
    id: `${conceptId}-stats`,
    profileId,
    conceptId,
    recent,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function makeGameRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: `game-${Math.random().toString(36)}`,
    profileId: 'p1',
    game: 'full',
    opponent: 'computer:1',
    result: 'win',
    reason: 'checkmate',
    moves: ['e4', 'e5'],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('buildChildOverview', () => {
  it('throws for an unknown profile', async () => {
    const deps = makeDeps();
    await expect(buildChildOverview(deps, 'ghost')).rejects.toThrow();
  });

  it('returns the profile, total stars, and 7-day minutes for a fresh profile', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([profile]) });

    const overview = await buildChildOverview(deps, 'p1');

    expect(overview.profile).toEqual(profile);
    expect(overview.totalStars).toBe(0);
    expect(overview.minutesToday).toBe(0);
    expect(overview.minutesLast7Days).toBe(0);
    expect(overview.streakCurrent).toBe(0);
  });

  it('sums minutesLast7Days and reads today’s minutes and the current streak', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const logs: SessionLog[] = [
      {
        id: 'l1',
        profileId: 'p1',
        date: '2026-01-09',
        minutes: 10,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      {
        id: 'l2',
        profileId: 'p1',
        date: '2026-01-10',
        minutes: 5,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ];
    const streak: Streak = {
      id: 's1',
      profileId: 'p1',
      current: 3,
      best: 3,
      skipsUsedThisWeek: 0,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      rewards: makeRewardsRepo({ sessionLogs: logs, streak }),
    });

    const overview = await buildChildOverview(deps, 'p1');

    expect(overview.minutesToday).toBe(5);
    expect(overview.minutesLast7Days).toBe(15);
    expect(overview.streakCurrent).toBe(3);
  });
});

describe('buildChildReport', () => {
  it('throws for an unknown profile', async () => {
    const deps = makeDeps();
    await expect(buildChildReport(deps, 'ghost')).rejects.toThrow();
  });

  it('summarizes progress by world (lessons complete/mastered, stars)', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    let l1Progress = newLessonProgress('lp1', 'p1', 'l1', NOW);
    l1Progress = recordExerciseStars(l1Progress, 'l1-01', 3, L1, NOW);
    l1Progress = recordExerciseStars(l1Progress, 'l1-02', 3, L1, NOW); // complete + mastered (6/6)
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      progress: makeProgressRepo([l1Progress]),
    });

    const report = await buildChildReport(deps, 'p1');

    expect(report.worlds).toHaveLength(1);
    const w1 = report.worlds[0];
    expect(w1?.lessonsTotal).toBe(2);
    expect(w1?.lessonsComplete).toBe(1);
    expect(w1?.lessonsMastered).toBe(1);
    expect(w1?.starsEarned).toBe(6);
    expect(w1?.starsMax).toBe(12); // 2 lessons x 2 exercises x 3 stars
  });

  it('reports concept accuracy (last 10) and the weak-concept list', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const weak = makeConceptStats('p1', 'concept-a', [false, false, true]); // 1/3 = weak
    const strong = makeConceptStats('p1', 'concept-b', [true, true, true, true]); // 4/4, not weak
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      progress: makeProgressRepo([], [weak, strong]),
    });

    const report = await buildChildReport(deps, 'p1');

    expect(report.conceptAccuracy).toEqual([
      { conceptId: 'concept-a', accuracy: 1 / 3, attempts: 3, weak: true },
      { conceptId: 'concept-b', accuracy: 1, attempts: 4, weak: false },
    ]);
    expect(report.weakConcepts).toEqual(['concept-a']);
  });

  it('reports minutes per day over the last 14 days', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const logs: SessionLog[] = [
      {
        id: 'l1',
        profileId: 'p1',
        date: '2026-01-10',
        minutes: 12,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ];
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      rewards: makeRewardsRepo({ sessionLogs: logs }),
    });

    const report = await buildChildReport(deps, 'p1');

    expect(report.minutesByDay).toHaveLength(14);
    expect(report.minutesByDay[13]).toEqual({ date: '2026-01-10', minutes: 12 });
    expect(report.minutesByDay[12]).toEqual({ date: '2026-01-09', minutes: 0 });
  });

  it("carries the profile's daily limit (M5.2, minutes-per-day chart's own limit line)", async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      settings: {
        get: () =>
          Promise.resolve<AppSettings>({
            lastProfileId: null,
            suggestedLevels: {},
            profileSettings: { p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 } },
          }),
        save: () => Promise.resolve(),
      },
    });

    expect((await buildChildReport(deps, 'p1')).dailyLimitMinutes).toBe(30);
  });

  it('reports the daily limit off (null) for a profile with none set', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([profile]) });

    expect((await buildChildReport(deps, 'p1')).dailyLimitMinutes).toBeNull();
  });

  it('lists the last 10 games, newest first', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const records = Array.from({ length: 12 }, (_, i) =>
      makeGameRecord({
        id: `g${String(i)}`,
        createdAt: new Date(NOW.getTime() + i * 1000).toISOString(),
      }),
    );
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      gameRecords: makeGameRecordRepo(records),
    });

    const report = await buildChildReport(deps, 'p1');

    expect(report.games).toHaveLength(10);
    expect(report.games[0]?.id).toBe('g11');
    expect(report.games[9]?.id).toBe('g2');
  });

  it('includes earned badges and assessment results (newest first)', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const badge: EarnedBadge = {
      id: 'b1',
      profileId: 'p1',
      badgeId: 'first-win',
      at: NOW.toISOString(),
      seen: false,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    const older: AssessmentResult = {
      id: 'a1',
      profileId: 'p1',
      kind: 'test-out',
      scope: { type: 'lesson', lessonId: 'l1', worldId: 'w1' },
      correct: 4,
      total: 5,
      passed: true,
      at: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const newer: AssessmentResult = {
      ...older,
      id: 'a2',
      at: '2026-01-09T00:00:00.000Z',
      createdAt: '2026-01-09T00:00:00.000Z',
      updatedAt: '2026-01-09T00:00:00.000Z',
    };
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      rewards: makeRewardsRepo({ badges: [badge] }),
      assessment: makeAssessmentRepo([older, newer]),
    });

    const report = await buildChildReport(deps, 'p1');

    expect(report.badges).toEqual([badge]);
    expect(report.assessments.map((a) => a.id)).toEqual(['a2', 'a1']);
  });

  it('is permissive (empty badges/assessments) without deps.rewards/deps.assessment wired up', async () => {
    const profile = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({
      profiles: makeProfileRepo([profile]),
      rewards: undefined,
      assessment: undefined,
    });

    const report = await buildChildReport(deps, 'p1');

    expect(report.badges).toEqual([]);
    expect(report.assessments).toEqual([]);
    expect(report.streakCurrent).toBe(0);
  });
});
