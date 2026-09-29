import { describe, expect, it } from 'vitest';

import { composeDefaultSettings } from '../domain/profile-settings.ts';
import { newProfile } from '../domain/profile.ts';
import type { Profile } from '../domain/profile.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { LessonProgress } from '../domain/progress.ts';
import { newEarnedBadge } from '../domain/badges.ts';
import type { EarnedBadge } from '../domain/badges.ts';
import type { BackupFile } from './backup.ts';
import type { BackupImporter } from './ports.ts';
import {
  makeProfileRepo,
  makeProgressRepo as buildProgressRepo,
  makeRewardsRepo as buildRewardsRepo,
  makeAssessmentRepo,
  makeBackupImporter,
  makeExercise,
  makeLesson as buildLesson,
  makeContentSource,
  makeDeps as buildDeps,
} from '../testing/index.ts';
import { importMerged, planImport, previewChildChange } from './merge.ts';
import type { AppDeps } from './use-cases.ts';

const NOW = new Date('2026-01-10T12:00:00.000Z');

const L1 = buildLesson({
  id: 'l1',
  world: 'w1',
  concept: 'l1-concept',
  exercises: [
    makeExercise({ id: 'l1-01', concept: 'l1-01-concept' }),
    makeExercise({ id: 'l1-02', concept: 'l1-02-concept' }),
  ],
});

function makeContent(): ReturnType<typeof makeContentSource> {
  return makeContentSource({ lessons: [L1] });
}

function makeProgressRepo(lessons: readonly LessonProgress[] = []): AppDeps['progress'] {
  return buildProgressRepo({ lessons });
}

function makeRewardsRepo(
  options: { readonly badges?: readonly EarnedBadge[] } = {},
): AppDeps['rewards'] {
  return buildRewardsRepo({ badges: options.badges });
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    rewards: makeRewardsRepo(),
    assessment: makeAssessmentRepo(),
    clock: { now: () => NOW },
    content: makeContent(),
    backupImporter: makeBackupImporter(),
    storageSchemaVersion: 5,
    ...overrides,
  });
}

const DEFAULT_PROFILE_SETTINGS = composeDefaultSettings(buildDeps({}).subject.settings);

/** A minimal, valid `BackupFile` for one child, built straight from literal data (not via
 * `buildBackupFile`, so these tests do not depend on a *second* `AppDeps`'s own repositories). */
function incomingFileFor(
  profile: Profile,
  overrides: Partial<BackupFile['data'][string]> = {},
): BackupFile {
  return {
    app: 'chess-kids',
    schemaVersion: 5,
    exportedAt: NOW.toISOString(),
    profiles: [profile],
    data: {
      [profile.id]: {
        settings: DEFAULT_PROFILE_SETTINGS,
        lessonProgress: [],
        attempts: [],
        miniGameProgress: [],
        conceptStats: [],
        gameRecords: [],
        earnedBadges: [],
        sessionLogs: [],
        assessmentResults: [],
        unlocks: [],
        ...overrides,
      },
    },
  };
}

describe('planImport', () => {
  it('auto-merges a child whose incoming id matches a local profile, no choice offered', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });
    const incoming = incomingFileFor(mia);

    const plan = await planImport(deps, incoming);

    expect(plan.children).toHaveLength(1);
    expect(plan.children[0]?.autoMerge).toBe(true);
    expect(plan.children[0]?.defaultChoice).toEqual({
      incomingProfileId: 'p1',
      kind: 'merge',
      localProfileId: 'p1',
    });
  });

  it('preselects "merge into" when the nickname matches (case-insensitive, trimmed)', async () => {
    const mia = newProfile('local-1', ' Mia ', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });
    const incomingMia = newProfile('other-device-1', 'mia', 'panda', NOW);
    const incoming = incomingFileFor(incomingMia);

    const plan = await planImport(deps, incoming);

    expect(plan.children[0]?.autoMerge).toBe(false);
    expect(plan.children[0]?.defaultChoice).toEqual({
      incomingProfileId: 'other-device-1',
      kind: 'merge',
      localProfileId: 'local-1',
    });
  });

  it('defaults to "add as new child" when no local nickname matches', async () => {
    const mia = newProfile('local-1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });
    const leo = newProfile('other-device-2', 'Leo', 'panda', NOW);
    const incoming = incomingFileFor(leo);

    const plan = await planImport(deps, incoming);

    expect(plan.children[0]?.defaultChoice).toEqual({
      incomingProfileId: 'other-device-2',
      kind: 'add-new',
    });
  });
});

describe('previewChildChange', () => {
  it('"add-new": every incoming number, local starts at zero', async () => {
    const deps = makeDeps();
    const leo = newProfile('incoming-1', 'Leo', 'panda', NOW);
    let progress = newLessonProgress('lp1', 'incoming-1', 'l1', NOW);
    progress = recordExerciseStars(progress, 'l1-01', 3, L1, NOW);
    const incoming = incomingFileFor(leo, {
      lessonProgress: [progress],
      earnedBadges: [newEarnedBadge('b1', 'incoming-1', 'first-win', undefined, NOW)],
    });

    const summary = await previewChildChange(deps, incoming, {
      incomingProfileId: 'incoming-1',
      kind: 'add-new',
    });

    expect(summary).toEqual({ starsDelta: 3, badgesDelta: 1, minutesThisWeekDelta: 0 });
  });

  it('"merge": the delta vs. the chosen local child’s current data', async () => {
    const mia = newProfile('local-1', 'Mia', 'fox', NOW);
    let localProgress = newLessonProgress('lp-local', 'local-1', 'l1', NOW);
    localProgress = recordExerciseStars(localProgress, 'l1-01', 1, L1, NOW);
    const deps = makeDeps({
      profiles: makeProfileRepo([mia]),
      progress: makeProgressRepo([localProgress]),
    });

    const incomingMia = newProfile('other-1', 'Mia', 'panda', NOW);
    let incomingProgress = newLessonProgress('lp-incoming', 'other-1', 'l1', NOW);
    incomingProgress = recordExerciseStars(incomingProgress, 'l1-01', 3, L1, NOW);
    const incoming = incomingFileFor(incomingMia, { lessonProgress: [incomingProgress] });

    const summary = await previewChildChange(deps, incoming, {
      incomingProfileId: 'other-1',
      kind: 'merge',
      localProfileId: 'local-1',
    });

    // local had 1 star on l1-01, incoming has 3 -> merged best is 3 -> delta +2.
    expect(summary.starsDelta).toBe(2);
  });
});

describe('importMerged', () => {
  it('auto-merges a same-id child, folding incoming progress into the local one', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    let localProgress = newLessonProgress('lp-local', 'p1', 'l1', NOW);
    localProgress = recordExerciseStars(localProgress, 'l1-01', 1, L1, NOW);
    const deps = makeDeps({
      profiles: makeProfileRepo([mia]),
      progress: makeProgressRepo([localProgress]),
    });

    let incomingProgress = newLessonProgress('lp-incoming', 'p1', 'l1', NOW);
    incomingProgress = recordExerciseStars(incomingProgress, 'l1-01', 3, L1, NOW);
    incomingProgress = recordExerciseStars(incomingProgress, 'l1-02', 2, L1, NOW);
    const incoming = incomingFileFor(mia, { lessonProgress: [incomingProgress] });

    const result = await importMerged(deps, incoming, []);

    expect(result.profileCount).toBe(1);
    expect(result.totalStars).toBe(5); // max(1,3) + 2

    const importer = deps.backupImporter as BackupImporter & { calls: BackupFile[] };
    const written = importer.calls[0];
    expect(written?.data.p1?.lessonProgress[0]?.bestStars).toEqual({ 'l1-01': 3, 'l1-02': 2 });
  });

  it('"add as new child": creates a new local profile with the incoming child’s own id and data', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });

    const leo = newProfile('other-1', 'Leo', 'panda', NOW);
    let leoProgress = newLessonProgress('lp-leo', 'other-1', 'l1', NOW);
    leoProgress = recordExerciseStars(leoProgress, 'l1-01', 2, L1, NOW);
    const incoming = incomingFileFor(leo, { lessonProgress: [leoProgress] });

    const result = await importMerged(deps, incoming, [
      { incomingProfileId: 'other-1', kind: 'add-new' },
    ]);

    expect(result.profileCount).toBe(2);
    const importer = deps.backupImporter as BackupImporter & { calls: BackupFile[] };
    const written = importer.calls[0];
    expect(written?.profiles.map((p) => p.id).sort()).toEqual(['other-1', 'p1']);
    expect(written?.data['other-1']?.lessonProgress[0]?.bestStars).toEqual({ 'l1-01': 2 });
  });

  it('"merge into a different local child": re-keys every incoming record to the chosen local id', async () => {
    const mia = newProfile('local-1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });

    const otherMia = newProfile('other-1', 'Mia', 'panda', NOW);
    let progress = newLessonProgress('lp-other', 'other-1', 'l1', NOW);
    progress = recordExerciseStars(progress, 'l1-01', 3, L1, NOW);
    const incoming = incomingFileFor(otherMia, { lessonProgress: [progress] });

    await importMerged(deps, incoming, [
      { incomingProfileId: 'other-1', kind: 'merge', localProfileId: 'local-1' },
    ]);

    const importer = deps.backupImporter as BackupImporter & { calls: BackupFile[] };
    const written = importer.calls[0];
    // Only the local profile row exists; nothing was kept under the incoming device's own id.
    expect(written?.profiles.map((p) => p.id)).toEqual(['local-1']);
    expect(written?.data['local-1']?.lessonProgress[0]?.profileId).toBe('local-1');
    // Local's own nickname/avatar are kept (decision table "Profile matching").
    expect(written?.profiles[0]?.nickname).toBe('Mia');
    expect(written?.profiles[0]?.avatar).toBe('fox');
  });

  it('importing the same file twice changes nothing further (idempotent end to end)', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });
    let progress = newLessonProgress('lp1', 'p1', 'l1', NOW);
    progress = recordExerciseStars(progress, 'l1-01', 3, L1, NOW);
    const incoming = incomingFileFor(mia, { lessonProgress: [progress] });

    const first = await importMerged(deps, incoming, []);
    const second = await importMerged(deps, incoming, []);

    expect(second.totalStars).toBe(first.totalStars);
    const importer = deps.backupImporter as BackupImporter & { calls: BackupFile[] };
    expect(importer.calls).toHaveLength(2); // called each time, but the written content is stable
    expect(importer.calls[1]?.data.p1?.lessonProgress).toEqual(
      importer.calls[0]?.data.p1?.lessonProgress,
    );
  });
});
