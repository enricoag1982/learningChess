import { describe, expect, it } from 'vitest';

import type { AssessmentScope } from '@learn/platform-core/domain/assessment';
import { scorePlacementWorld, scoreTestOut } from '@learn/platform-core/domain/assessment';
import type { Track, TracksCatalog, World } from '@learn/platform-core/domain/journey';
import {
  makeAssessmentRepo as buildAssessmentRepo,
  makeExercise as buildExercise,
  makeLesson as buildLesson,
  makeContentSource,
  makeDeps as buildDeps,
} from '@learn/platform-core/testing';
import { loadUnlocked, parentUnlock, submitAssessment } from '@learn/platform-core/app/assessment';
import { loadJourney } from '@learn/platform-core/app/journey';
import type { AssessmentRepository, ContentSource } from '@learn/platform-core/app/ports';
import type { AppDeps } from '@learn/platform-core/app/use-cases';

function makeLesson(
  id: string,
  world: string,
  order: number,
  overrides: Partial<ReturnType<typeof buildLesson>> = {},
) {
  return buildLesson({
    id,
    world,
    order,
    concept: `${id}-concept`,
    exercises: [
      buildExercise({ id: `${id}-01`, concept: `${id}-concept` }),
      buildExercise({ id: `${id}-02`, concept: `${id}-concept` }),
    ],
    ...overrides,
  });
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
  return makeContentSource({ lessons: LESSONS, catalog: CATALOG });
}

function makeAssessmentRepo(): AssessmentRepository {
  return buildAssessmentRepo();
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    assessment: makeAssessmentRepo(),
    content: makeContent(),
    ...overrides,
  });
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
