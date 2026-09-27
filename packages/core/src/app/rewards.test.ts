import { describe, expect, it } from 'vitest';

import type { BadgeDef, EarnedBadge } from '../domain/badges.ts';
import type { Track, TracksCatalog, World } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { Attempt, GameRecord, LessonProgress } from '../domain/progress.ts';
import {
  makeExercise as buildExercise,
  makeLesson as buildLesson,
  makeContentSource,
  makeDeps as buildDeps,
  makeClock,
  makeGameRecordRepo,
  makeProgressRepo as buildProgressRepo,
  makeRewardsRepo as buildRewardsRepo,
  makeAttempt as buildAttempt,
} from '../testing/index.ts';
import type { ContentSource, RewardsRepository } from './ports.ts';
import {
  buildBadgeFacts,
  checkRewards,
  evaluateAndRecordBadges,
  minutesByDay,
  recordDailyActivity,
  recordSessionMinutes,
  starsToday,
} from './rewards.ts';
import type { AppDeps } from './use-cases.ts';

const NOW = new Date('2026-01-05T12:00:00.000Z'); // a Monday

function makeExercise(id: string, concept = 'rook-move') {
  return buildExercise({ id, concept });
}

function makeLesson(
  id: string,
  world: string,
  exercises: readonly ReturnType<typeof buildExercise>[],
): Lesson {
  return buildLesson({ id, world, exercises: [...exercises] });
}

const WORLD: World = { id: 'w1', track: 't1', order: 1, habitat: 'meadow', titleKey: 'w1' };
const TRACK: Track = { id: 't1', kind: 'main', titleKey: 't1', worlds: [WORLD] };
const CATALOG: TracksCatalog = { tracks: [TRACK], ranks: [{ id: 'pawn', after: 'start' }] };

function makeProgressRepo(
  lessons: readonly LessonProgress[] = [],
  attempts: readonly Attempt[] = [],
): AppDeps['progress'] {
  return buildProgressRepo({ lessons, attempts });
}

function makeRewardsRepo(initialEarned: readonly EarnedBadge[] = []): RewardsRepository {
  return buildRewardsRepo({ badges: initialEarned });
}

function makeContent(lessons: readonly Lesson[], badges: readonly BadgeDef[] = []): ContentSource {
  return makeContentSource({ lessons, badges, catalog: CATALOG });
}

/** `p1`/`l1`/`ex1`/`hanging-piece` defaults, distinct from the kit's own (`profile-1`/`rook`/…) —
 * every `starsToday`/`recordDailyActivity`/… call in this file queries by these ids. */
function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return buildAttempt({
    id: `attempt-${Math.random().toString(36)}`,
    profileId: 'p1',
    lessonId: 'l1',
    exerciseId: 'ex1',
    conceptId: 'hanging-piece',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  });
}

function baseDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    rewards: makeRewardsRepo(),
    clock: makeClock(NOW),
    content: makeContent([]),
    ...overrides,
  });
}

describe('recordDailyActivity', () => {
  it('starts a streak at 1 on the first call, no-ops on a second call the same day', async () => {
    const deps = baseDeps();
    const first = await recordDailyActivity(deps, 'p1', NOW);
    expect(first.current).toBe(1);
    const second = await recordDailyActivity(deps, 'p1', NOW);
    expect(second.current).toBe(1);
    expect(second.lastDay).toBe(first.lastDay);
  });
});

describe('recordSessionMinutes', () => {
  it('sums minutes across two calls the same day', async () => {
    const deps = baseDeps();
    await recordSessionMinutes(deps, 'p1', 5, NOW);
    const log = await recordSessionMinutes(deps, 'p1', 7, new Date(NOW.getTime() + 1000));
    expect(log.minutes).toBe(12);
  });
});

describe('minutesByDay', () => {
  it('returns 0 for every day with no session-log row', async () => {
    const deps = baseDeps();
    const days = await minutesByDay(deps, 'p1', 3);
    expect(days).toEqual([
      { date: '2026-01-03', minutes: 0 },
      { date: '2026-01-04', minutes: 0 },
      { date: '2026-01-05', minutes: 0 },
    ]);
  });

  it('fills in real minutes for days that have a session-log row, oldest first', async () => {
    const deps = baseDeps();
    await deps.rewards?.saveSessionLog({
      id: 'l1',
      profileId: 'p1',
      date: '2026-01-04',
      minutes: 15,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    await deps.rewards?.saveSessionLog({
      id: 'l2',
      profileId: 'p1',
      date: '2026-01-05',
      minutes: 8,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    const days = await minutesByDay(deps, 'p1', 3);
    expect(days).toEqual([
      { date: '2026-01-03', minutes: 0 },
      { date: '2026-01-04', minutes: 15 },
      { date: '2026-01-05', minutes: 8 },
    ]);
  });

  it('never mixes in another profile’s minutes', async () => {
    const deps = baseDeps();
    await deps.rewards?.saveSessionLog({
      id: 'l1',
      profileId: 'other',
      date: '2026-01-05',
      minutes: 99,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    const days = await minutesByDay(deps, 'p1', 1);
    expect(days).toEqual([{ date: '2026-01-05', minutes: 0 }]);
  });

  it('returns every day as 0 without deps.rewards wired up', async () => {
    const deps = baseDeps({ rewards: undefined });
    const days = await minutesByDay(deps, 'p1', 2);
    expect(days).toEqual([
      { date: '2026-01-04', minutes: 0 },
      { date: '2026-01-05', minutes: 0 },
    ]);
  });
});

describe('starsToday', () => {
  it("sums today's scored attempts' stars, ignoring other days and unscored attempts", async () => {
    const deps = baseDeps({
      progress: makeProgressRepo(
        [],
        [
          makeAttempt({ stars: 3, createdAt: NOW.toISOString() }),
          makeAttempt({ stars: 2, createdAt: NOW.toISOString() }),
          makeAttempt({ stars: 3, scored: false, createdAt: NOW.toISOString() }), // easier variant
          makeAttempt({ stars: 1, createdAt: '2026-01-04T12:00:00.000Z' }), // yesterday
        ],
      ),
    });
    expect(await starsToday(deps, 'p1', NOW)).toBe(5);
  });

  it('is 0 with nothing attempted today', async () => {
    const deps = baseDeps();
    expect(await starsToday(deps, 'p1', NOW)).toBe(0);
  });
});

describe('buildBadgeFacts', () => {
  it('derives masteredScopes/starsTotal/perfectLessons from progress + journey', async () => {
    const exercise = makeExercise('l1-01');
    const lesson = makeLesson('l1', 'w1', [exercise]);
    const progress: LessonProgress = recordExerciseStars(
      newLessonProgress('lp1', 'p1', 'l1', NOW),
      'l1-01',
      3,
      lesson,
      NOW,
    );
    const deps = baseDeps({
      content: makeContent([lesson]),
      progress: makeProgressRepo([progress]),
    });

    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    const facts = await buildBadgeFacts(deps, 'p1', journey, 0);

    expect(facts.masteredScopes.has('world:w1')).toBe(true);
    expect(facts.masteredScopes.has('track:t1')).toBe(true);
    expect(facts.starsTotal).toBe(3);
    expect(facts.perfectLessons).toBe(1);
  });

  it('computes concept-correct-in-a-row and no-hints-in-a-row, reset by a break', async () => {
    const attempts: Attempt[] = [
      makeAttempt({
        conceptId: 'hanging-piece',
        correct: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      makeAttempt({
        conceptId: 'hanging-piece',
        correct: true,
        createdAt: '2026-01-01T00:00:01.000Z',
      }),
      makeAttempt({
        conceptId: 'hanging-piece',
        correct: false,
        stars: 1,
        hints: 1,
        createdAt: '2026-01-01T00:00:02.000Z',
      }),
      makeAttempt({
        conceptId: 'hanging-piece',
        correct: true,
        createdAt: '2026-01-01T00:00:03.000Z',
      }),
    ];
    const deps = baseDeps({ progress: makeProgressRepo([], attempts) });
    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    const facts = await buildBadgeFacts(deps, 'p1', journey, 0);

    expect(facts.conceptCorrectTotal['hanging-piece']).toBe(3);
    // Broken by the 3rd (wrong) attempt: only the trailing correct one counts.
    expect(facts.conceptCorrectInARow['hanging-piece']).toBe(1);
    // The 3rd attempt used a hint, breaking the no-hints streak too.
    expect(facts.conceptNoHintsInARow['hanging-piece']).toBe(1);
  });

  // Game-record-derived facts (game wins, promotion/castling, queen-kept) moved to
  // domain/chess/facts/rewards.test.ts (`chessRewardFacts`) — buildBadgeFacts no longer computes
  // them (design-r4.md §2 leak #4); evaluateAndRecordBadges's own test below covers the wiring.

  it('counts warm-up-sourced review attempts, not practice-sourced ones', async () => {
    const attempts: Attempt[] = [
      makeAttempt({ review: true, reviewSource: 'warmup' }),
      makeAttempt({ review: true, reviewSource: 'warmup' }),
      makeAttempt({ review: true, reviewSource: 'practice' }),
    ];
    const deps = baseDeps({ progress: makeProgressRepo([], attempts) });
    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    const facts = await buildBadgeFacts(deps, 'p1', journey, 0);
    expect(facts.warmupsCompleted).toBe(2);
  });

  it('counts a comeback: solved with >= 2 errors', async () => {
    const attempts: Attempt[] = [
      makeAttempt({ stars: 1, errors: 2 }),
      makeAttempt({ stars: 0, errors: 3 }), // never solved: does not count
      makeAttempt({ stars: 3, errors: 0 }), // solved cleanly: does not count
    ];
    const deps = baseDeps({ progress: makeProgressRepo([], attempts) });
    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    const facts = await buildBadgeFacts(deps, 'p1', journey, 0);
    expect(facts.comebackCount).toBe(1);
  });
});

describe('evaluateAndRecordBadges', () => {
  it('persists newly earned badges and returns them', async () => {
    const badge: BadgeDef = {
      id: 'star-collector',
      category: 'skill',
      nameKey: 'rewards:badges.star-collector.name',
      conditionKey: 'rewards:badges.star-collector.condition',
      condition: { type: 'stars-total', thresholds: [1] },
    };
    const exercise = makeExercise('l1-01');
    const lesson = makeLesson('l1', 'w1', [exercise]);
    const progress = recordExerciseStars(
      newLessonProgress('lp1', 'p1', 'l1', NOW),
      'l1-01',
      3,
      lesson,
      NOW,
    );
    const rewards = makeRewardsRepo();
    const deps = baseDeps({
      content: makeContent([lesson], [badge]),
      progress: makeProgressRepo([progress]),
      rewards,
    });

    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    const earned = await evaluateAndRecordBadges(deps, 'p1', journey, 0, NOW);

    expect(earned.map((b) => b.badgeId)).toEqual(['star-collector']);
    expect(await rewards.listEarnedBadges('p1')).toHaveLength(1);
  });

  it('returns [] when the content has no badges wired up', async () => {
    const deps = baseDeps({ content: makeContent([]) });
    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    expect(await evaluateAndRecordBadges(deps, 'p1', journey, 0, NOW)).toEqual([]);
  });

  it('earns a game-win badge via deps.subject.rewards (chess facts, not the generic engine)', async () => {
    const badge: BadgeDef = {
      id: 'mouse-tamer',
      category: 'play',
      nameKey: 'rewards:badges.mouse-tamer.name',
      conditionKey: 'rewards:badges.mouse-tamer.condition',
      condition: { type: 'game-win', opponent: 'computer:1', thresholds: [1] },
    };
    const record: GameRecord = {
      id: 'g1',
      profileId: 'p1',
      game: 'full',
      opponent: 'computer:1',
      result: 'win',
      reason: 'checkmate',
      moves: [],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    const deps = baseDeps({
      content: makeContent([], [badge]),
      gameRecords: makeGameRecordRepo([record]),
    });
    const { loadJourney } = await import('./journey.ts');
    const journey = await loadJourney(deps, 'p1');
    const earned = await evaluateAndRecordBadges(deps, 'p1', journey, 0, NOW);
    expect(earned.map((b) => b.badgeId)).toEqual(['mouse-tamer']);
  });
});

describe('checkRewards', () => {
  it('no-ops (no error, empty result) when deps.rewards is not wired up', async () => {
    const deps = baseDeps({ rewards: undefined });
    const result = await checkRewards(deps, 'p1');
    expect(result.newBadges).toEqual([]);
  });

  it('no-ops the badge half alone when content.catalog() is not wired up, streak still counts', async () => {
    const contentWithoutCatalog: ContentSource = {
      lessons: () => [],
      lesson: () => undefined,
      minigames: () => [],
      minigame: () => undefined,
    };
    const deps = baseDeps({ content: contentWithoutCatalog });
    const result = await checkRewards(deps, 'p1');
    expect(result.streak.current).toBe(1);
    expect(result.newBadges).toEqual([]);
  });

  it('folds today into the streak and evaluates badges together', async () => {
    const badge: BadgeDef = {
      id: 'star-collector',
      category: 'skill',
      nameKey: 'rewards:badges.star-collector.name',
      conditionKey: 'rewards:badges.star-collector.condition',
      condition: { type: 'stars-total', thresholds: [1] },
    };
    const exercise = makeExercise('l1-01');
    const lesson = makeLesson('l1', 'w1', [exercise]);
    const progress = recordExerciseStars(
      newLessonProgress('lp1', 'p1', 'l1', NOW),
      'l1-01',
      3,
      lesson,
      NOW,
    );
    const deps = baseDeps({
      content: makeContent([lesson], [badge]),
      progress: makeProgressRepo([progress]),
    });

    const result = await checkRewards(deps, 'p1');
    expect(result.streak.current).toBe(1);
    expect(result.newBadges.map((b) => b.badgeId)).toEqual(['star-collector']);

    // Calling again the same "now" finds nothing new (idempotent).
    const again = await checkRewards(deps, 'p1');
    expect(again.newBadges).toEqual([]);
  });
});
