import { describe, expect, it } from 'vitest';

import type { Track, TracksCatalog, World } from '@learn/platform-core/domain/journey';
import {
  newLessonProgress,
  recordExerciseStars,
  withResumeStep,
} from '@learn/platform-core/domain/progress';
import type { LessonProgress, MiniGameProgress } from '@learn/platform-core/domain/progress';
import type { ConceptStats } from '@learn/platform-core/domain/review';
import {
  makeProgressRepo as buildProgressRepo,
  seededRandom,
  makeExercise as buildExercise,
  makeLesson as buildLesson,
  makeMiniGame as buildMiniGame,
  makeContentSource,
  makeDeps as buildDeps,
} from '@learn/platform-core/testing';
import {
  loadPracticeTasks,
  loadTodaySession,
  loadWarmUp,
  planTodaySession,
} from '@learn/platform-core/app/session';
import type { ContentSource } from '@learn/platform-core/app/ports';
import type { AppDeps } from '@learn/platform-core/app/use-cases';

const NOW = new Date('2026-02-01T00:00:00.000Z');

function makeLesson(id: string, world: string, order: number) {
  return buildLesson({
    id,
    world,
    order,
    concept: `${id}-concept`,
    exercises: [
      buildExercise({ id: `${id}-01`, concept: `${id}-concept` }),
      buildExercise({ id: `${id}-02`, concept: `${id}-concept` }),
    ],
  });
}

function completeProgress(lesson: ReturnType<typeof makeLesson>): LessonProgress {
  let progress = newLessonProgress(`p-${lesson.id}`, 'profile-1', lesson.id, NOW);
  for (const exercise of lesson.exercises) {
    progress = recordExerciseStars(progress, exercise.id, 3, lesson, NOW);
  }
  return progress;
}

const W1: World = {
  id: 'w1',
  track: 'basics',
  order: 1,
  habitat: 'meadow',
  titleKey: 'journey:worlds.board',
};
const BASICS: Track = {
  id: 'basics',
  kind: 'main',
  titleKey: 'journey:tracks.basics',
  worlds: [W1],
};
const CATALOG: TracksCatalog = {
  tracks: [BASICS],
  ranks: [
    { id: 'pawn', after: 'start' },
    { id: 'knight', after: 'world:w1' },
  ],
};

const L1 = makeLesson('l1', 'w1', 1);
const L2 = makeLesson('l2', 'w1', 2);
const LESSONS = [L1, L2];

const MG1 = buildMiniGame({
  id: 'mg1',
  concept: 'mg1-concept',
  titleKey: 'fixtures:mg1.title',
  goalKey: 'fixtures:mg1.goal',
  unlockAfter: 'l1',
  par: 5,
});
const MG2 = { ...MG1, id: 'mg2', unlockAfter: 'l2', titleKey: 'fixtures:mg2.title' };

function makeContent(
  overrides: Partial<{
    lessons: readonly ReturnType<typeof makeLesson>[];
    minigames: readonly ReturnType<typeof buildMiniGame>[];
  }> = {},
): ContentSource {
  return makeContentSource({
    lessons: overrides.lessons ?? LESSONS,
    minigames: overrides.minigames ?? [],
    catalog: CATALOG,
  });
}

function makeProgressRepo(
  lessons: readonly LessonProgress[] = [],
  miniGames: readonly MiniGameProgress[] = [],
  conceptStats: readonly ConceptStats[] = [],
): AppDeps['progress'] {
  return buildProgressRepo({ lessons, miniGames, conceptStats });
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    clock: { now: () => NOW },
    content: makeContent(),
    ...overrides,
  });
}

function dueStats(conceptId: string, overrides: Partial<ConceptStats> = {}): ConceptStats {
  return {
    id: `cs-${conceptId}`,
    profileId: 'profile-1',
    conceptId,
    recent: [],
    box: 1,
    dueAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('loadWarmUp', () => {
  it('is empty when no concept is in review', async () => {
    const deps = makeDeps();
    expect(await loadWarmUp(deps, 'profile-1')).toEqual([]);
  });

  it("loads due concept stats and picks a task from that concept's content pool", async () => {
    const deps = makeDeps({
      progress: makeProgressRepo([], [], [dueStats('l1-concept')]),
    });

    const tasks = await loadWarmUp(deps, 'profile-1');

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.conceptId).toBe('l1-concept');
    expect(tasks[0]?.lessonId).toBe('l1');
    expect(['l1-01', 'l1-02']).toContain(tasks[0]?.exercise.id);
  });
});

describe('loadPracticeTasks', () => {
  it("defaults to 5 tasks for the concept, from stored stats' pool", async () => {
    const deps = makeDeps({
      progress: makeProgressRepo([], [], [dueStats('l1-concept', { lastExerciseId: 'l1-01' })]),
    });

    const tasks = await loadPracticeTasks(deps, 'profile-1', 'l1-concept');

    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.conceptId === 'l1-concept')).toBe(true);
  });

  it('honours an explicit count', async () => {
    const deps = makeDeps();
    const tasks = await loadPracticeTasks(deps, 'profile-1', 'l1-concept', 2);
    expect(tasks).toHaveLength(2);
  });
});

describe('planTodaySession', () => {
  it('new kid: only the next lesson — no warm-up (nothing in review), no mini-game (nothing unlocked)', () => {
    const plan = planTodaySession(CATALOG, LESSONS, [MG1], [], [], [], NOW, seededRandom(1));
    expect(plan.activities).toEqual([{ kind: 'lesson', lesson: L1 }]);
  });

  it("mid-lesson: the in-progress lesson is the activity (same as the Journey's next step)", () => {
    const inProgress = withResumeStep(newLessonProgress('p-l1', 'profile-1', 'l1', NOW), 1, NOW);
    const plan = planTodaySession(CATALOG, LESSONS, [], [inProgress], [], [], NOW, seededRandom(1));
    expect(plan.activities).toEqual([{ kind: 'lesson', lesson: L1 }]);
  });

  it('all lessons done, no world boss, one concept due: warm-up only, plus its unlocked mini-game', () => {
    const progresses = [completeProgress(L1), completeProgress(L2)];
    const stats = [dueStats('l1-concept')];

    const plan = planTodaySession(
      CATALOG,
      LESSONS,
      [MG1],
      progresses,
      [],
      stats,
      NOW,
      seededRandom(1),
    );

    expect(plan.activities).toHaveLength(2);
    expect(plan.activities[0]).toMatchObject({ kind: 'warmup' });
    expect(plan.activities[0]).toMatchObject({ tasks: [{ conceptId: 'l1-concept' }] });
    expect(plan.activities[1]).toEqual({ kind: 'minigame', miniGame: MG1 });
  });

  it('warm-up (if due) comes before the next lesson', () => {
    const progresses = [completeProgress(L1)];
    const stats = [dueStats('l1-concept')];

    const plan = planTodaySession(
      CATALOG,
      LESSONS,
      [],
      progresses,
      [],
      stats,
      NOW,
      seededRandom(1),
    );

    expect(plan.activities.map((a) => a.kind)).toEqual(['warmup', 'lesson']);
    expect(plan.activities[1]).toEqual({ kind: 'lesson', lesson: L2 });
  });

  it('picks the most recently unlocked mini-game with best stars < 3 over an already-3-star one', () => {
    const progresses = [completeProgress(L1), completeProgress(L2)];
    const miniGameProgresses: readonly MiniGameProgress[] = [
      {
        id: 'mgp-1',
        profileId: 'profile-1',
        miniGameId: MG1.id,
        bestStars: 3,
        plays: 1,
        wins: 1,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ];

    const plan = planTodaySession(
      CATALOG,
      LESSONS,
      [MG1, MG2],
      progresses,
      miniGameProgresses,
      [],
      NOW,
      seededRandom(1),
    );

    expect(plan.activities).toEqual([{ kind: 'minigame', miniGame: MG2 }]);
  });
});

describe('planTodaySession with a world boss', () => {
  const W1_BOSS: World = { ...W1, boss: 'mg1' };
  const BASICS_BOSS: Track = { ...BASICS, worlds: [W1_BOSS] };
  const CATALOG_BOSS: TracksCatalog = { ...CATALOG, tracks: [BASICS_BOSS] };

  it("does not also pick the world boss's own mini-game as the trailing minigame activity", () => {
    const progresses = [completeProgress(L1), completeProgress(L2)];

    const plan = planTodaySession(
      CATALOG_BOSS,
      LESSONS,
      [MG1],
      progresses,
      [],
      [],
      NOW,
      seededRandom(1),
    );

    expect(plan.activities).toEqual([{ kind: 'world-boss', world: W1_BOSS }]);
  });

  it('still picks a different unlocked mini-game after the world boss', () => {
    const progresses = [completeProgress(L1), completeProgress(L2)];

    const plan = planTodaySession(
      CATALOG_BOSS,
      LESSONS,
      [MG1, MG2],
      progresses,
      [],
      [],
      NOW,
      seededRandom(1),
    );

    expect(plan.activities).toEqual([
      { kind: 'world-boss', world: W1_BOSS },
      { kind: 'minigame', miniGame: MG2 },
    ]);
  });
});

describe('loadTodaySession', () => {
  it('wires content + stored progress/stats into planTodaySession', async () => {
    const deps = makeDeps({
      content: makeContent({ minigames: [MG1] }),
      progress: makeProgressRepo(
        [completeProgress(L1), completeProgress(L2)],
        [],
        [dueStats('l1-concept')],
      ),
    });

    const plan = await loadTodaySession(deps, 'profile-1');

    expect(plan.activities.map((a) => a.kind)).toEqual(['warmup', 'minigame']);
  });
});
