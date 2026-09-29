import { z } from 'zod';
import { composeDefaultSettings, isValidProfileSettings } from '../domain/profile-settings.ts';
import { localDayString } from '../domain/streak.ts';
import type { Profile } from '../domain/profile.ts';
import type { MergeableProfileData } from '../domain/merge.ts';
import type { AppConfig, SettingsBackupShape } from '../domain/subject.ts';
import type { BackupFileWriter, BackupImporter } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

// No `new Function` fast path: the production CSP (`script-src 'self'`) would report zod's eval
// probe as a violation. Set before any schema below is built (object schemas read it at init).
z.config({ jitless: true });

/** Every stored record for a child except its `Profile` row (in `BackupFile.profiles`) and the parent password. */
export type ProfileBackupData = MergeableProfileData;

/** One JSON file: every profile ("Export") or a single one ("Export per child"), same format. */
export interface BackupFile {
  /** `deps.app.backupAppId`: importing into a different subject's app is rejected. */
  readonly app: string;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly profiles: readonly Profile[];
  readonly data: Readonly<Record<string, ProfileBackupData>>;
}

const storedRecordFields = { id: z.string(), createdAt: z.string(), updatedAt: z.string() };

const profileSchema = z.object({
  ...storedRecordFields,
  accountId: z.string(),
  nickname: z.string(),
  avatar: z.string(),
  locale: z.string(),
});

/** `dailyLimitMinutes` .. `hints` and `weekendLimitMinutes` .. `updatedAt`; the subject's shape (`loadBackupShape()`)
 * splices in between, same key order as `composeDefaultSettings`. */
function profileSettingsSchema(subjectShape: SettingsBackupShape) {
  return z.object({
    dailyLimitMinutes: z.number().nullable(),
    voice: z.boolean(),
    sound: z.boolean(),
    hints: z.boolean(),
    ...subjectShape,
    weekendLimitMinutes: z.number().nullable().optional(),
    playUntil: z.string().nullable().optional(),
    playFrom: z.string().nullable().optional(),
    updatedAt: z.string().optional(),
  });
}

const starsSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const lessonProgressSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  lessonId: z.string(),
  bestStars: z.record(z.string(), z.union([z.literal(1), z.literal(2), z.literal(3)])),
  bossStars: starsSchema,
  resumeStep: z.number(),
  completedAt: z.string().optional(),
  masteredVia: z.enum(['play', 'test-out', 'placement', 'parent']).optional(),
  skippedPhases: z.array(z.enum(['story', 'demo', 'try'])).optional(),
});

const attemptSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  lessonId: z.string(),
  exerciseId: z.string(),
  conceptId: z.string(),
  scored: z.boolean(),
  review: z.boolean().optional(),
  reviewSource: z.enum(['warmup', 'practice']).optional(),
  correct: z.boolean(),
  stars: starsSchema,
  hints: z.number(),
  errors: z.number(),
  moves: z.number(),
  durationMs: z.number(),
});

const miniGameProgressSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  miniGameId: z.string(),
  bestStars: starsSchema,
  plays: z.number(),
  wins: z.number(),
});

const conceptStatsSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  conceptId: z.string(),
  recent: z.array(z.boolean()),
  box: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  dueAt: z.string().optional(),
  lastExerciseId: z.string().optional(),
});

const gameRecordSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  game: z.string(),
  opponent: z.string(),
  result: z.enum(['win', 'loss', 'draw', 'abandoned']),
  reason: z.string(),
  moves: z.array(z.string()),
  color: z.enum(['w', 'b']).optional(),
});

const earnedBadgeSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  badgeId: z.string(),
  tier: z.enum(['bronze', 'silver', 'gold']).optional(),
  at: z.string(),
  seen: z.boolean(),
});

const streakSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  current: z.number(),
  best: z.number(),
  lastDay: z.string().optional(),
  skipsUsedThisWeek: z.number(),
});

const sessionLogSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  date: z.string(),
  minutes: z.number(),
});

const assessmentScopeSchema = z.union([
  z.object({ type: z.literal('lesson'), lessonId: z.string(), worldId: z.string() }),
  z.object({ type: z.literal('world'), worldId: z.string() }),
]);

const assessmentResultSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  kind: z.enum(['test-out', 'placement']),
  scope: assessmentScopeSchema,
  correct: z.number(),
  total: z.number(),
  passed: z.boolean(),
  at: z.string(),
});

const unlockSchema = z.object({
  ...storedRecordFields,
  profileId: z.string(),
  targetType: z.enum(['lesson', 'world']),
  targetId: z.string(),
  via: z.enum(['test-out', 'placement', 'parent']),
});

function profileBackupDataSchema(subjectShape: SettingsBackupShape) {
  return z.object({
    settings: profileSettingsSchema(subjectShape),
    lessonProgress: z.array(lessonProgressSchema),
    attempts: z.array(attemptSchema),
    miniGameProgress: z.array(miniGameProgressSchema),
    conceptStats: z.array(conceptStatsSchema),
    gameRecords: z.array(gameRecordSchema),
    earnedBadges: z.array(earnedBadgeSchema),
    streak: streakSchema.optional(),
    sessionLogs: z.array(sessionLogSchema),
    assessmentResults: z.array(assessmentResultSchema),
    unlocks: z.array(unlockSchema),
  });
}

/** Shape-only validation; field types match the domain interfaces, so a parse is safe to treat as a {@link BackupFile}. */
function backupFileSchema(subjectShape: SettingsBackupShape) {
  return z.object({
    app: z.string(),
    schemaVersion: z.number().int().positive(),
    exportedAt: z.string(),
    profiles: z.array(profileSchema),
    data: z.record(z.string(), profileBackupDataSchema(subjectShape)),
  });
}

/** Corrupt JSON, wrong shape or newer schema version; the Import UI shows `message` and changes nothing. */
export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function requireBackupFileWriter(deps: AppDeps): BackupFileWriter {
  if (deps.backupFileWriter === undefined) {
    throw new Error('AppDeps.backupFileWriter is not wired up');
  }
  return deps.backupFileWriter;
}

export function requireBackupImporter(deps: AppDeps): BackupImporter {
  if (deps.backupImporter === undefined) {
    throw new Error('AppDeps.backupImporter is not wired up');
  }
  return deps.backupImporter;
}

/** `deps.storageSchemaVersion`, or `1` when `AppDeps` predates it (fixtures without backup wiring). */
function schemaVersion(deps: AppDeps): number {
  return deps.storageSchemaVersion ?? 1;
}

async function profileBackupData(deps: AppDeps, profileId: string): Promise<ProfileBackupData> {
  const [
    settings,
    lessonProgress,
    attempts,
    miniGameProgress,
    conceptStats,
    gameRecords,
    earnedBadges,
    streak,
    sessionLogs,
    assessmentResults,
    unlocks,
  ] = await Promise.all([
    deps.settings
      .get()
      .then(
        (all) => all.profileSettings[profileId] ?? composeDefaultSettings(deps.subject.settings),
      ),
    deps.progress.listLessons(profileId),
    deps.progress.listAttempts(profileId),
    deps.progress.listMiniGames(profileId),
    deps.progress.listConceptStats(profileId),
    deps.gameRecords.listByProfile(profileId),
    deps.rewards?.listEarnedBadges(profileId) ?? Promise.resolve([]),
    deps.rewards?.getStreak(profileId),
    deps.rewards?.listSessionLogs(profileId) ?? Promise.resolve([]),
    deps.assessment?.listAssessmentResults(profileId) ?? Promise.resolve([]),
    deps.assessment?.listUnlocks(profileId) ?? Promise.resolve([]),
  ]);

  return {
    settings,
    lessonProgress,
    attempts,
    miniGameProgress,
    conceptStats,
    gameRecords,
    earnedBadges,
    ...(streak === undefined ? {} : { streak }),
    sessionLogs,
    assessmentResults,
    unlocks,
  };
}

/** `profileIds` omitted = every profile; "Export" and "Export per child" share it. */
export async function buildBackupFile(
  deps: AppDeps,
  profileIds?: readonly string[],
): Promise<BackupFile> {
  const allProfiles = await deps.profiles.list();
  const profiles =
    profileIds === undefined
      ? allProfiles
      : allProfiles.filter((profile) => profileIds.includes(profile.id));

  const entries = await Promise.all(
    profiles.map(
      async (profile) => [profile.id, await profileBackupData(deps, profile.id)] as const,
    ),
  );

  return {
    app: deps.app.backupAppId,
    schemaVersion: schemaVersion(deps),
    exportedAt: deps.clock.now().toISOString(),
    profiles,
    data: Object.fromEntries(entries),
  };
}

/** `<nickname>` lower-cased, non `[a-z0-9]` runs collapsed to one `-`, trimmed — for a per-child
 * export's filename; `''` if `nickname` has no such character (an emoji-only nickname, say). */
function slug(nickname: string): string {
  return nickname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `<backupAppId>-backup-<date>.json`, or `...-<nickname>-<date>.json` per child. */
export function backupFileName(app: AppConfig, now: Date, nickname?: string): string {
  const date = localDayString(now);
  const nicknameSlug = nickname === undefined ? '' : slug(nickname);
  return nicknameSlug === ''
    ? `${app.backupAppId}-backup-${date}.json`
    : `${app.backupAppId}-backup-${nicknameSlug}-${date}.json`;
}

/** `<nickname>` or `all`, slugged, for the "Send to other device" filename (differs from {@link backupFileName}, kept for "Export"). */
export function shareFileName(app: AppConfig, now: Date, nickname?: string): string {
  const date = localDayString(now);
  const label = nickname === undefined ? '' : slug(nickname);
  return `${app.backupFilePrefix}-${label === '' ? 'all' : label}-${date}.json`;
}

/** The same JSON {@link exportBackup} writes, returned instead ("Send to other device": `navigator.share` / `Blob`). */
export async function buildShareFile(
  deps: AppDeps,
  profileIds?: readonly string[],
): Promise<{ readonly filename: string; readonly contents: string }> {
  const file = await buildBackupFile(deps, profileIds);
  const nickname = profileIds?.length === 1 ? file.profiles[0]?.nickname : undefined;
  return {
    filename: shareFileName(deps.app, deps.clock.now(), nickname),
    contents: JSON.stringify(file, null, 2),
  };
}

/** "Export" / "Export per child": builds the file and writes it via `deps.backupFileWriter` (web: a download);
 * `[id]` puts that nickname in the filename. */
export async function exportBackup(deps: AppDeps, profileIds?: readonly string[]): Promise<void> {
  const file = await buildBackupFile(deps, profileIds);
  // Nickname in the filename depends on which call this is, not on how many profiles the result holds.
  const nickname = profileIds?.length === 1 ? file.profiles[0]?.nickname : undefined;
  const filename = backupFileName(deps.app, deps.clock.now(), nickname);
  await requireBackupFileWriter(deps).write(filename, JSON.stringify(file, null, 2));
}

/** Corrupt JSON, wrong `app` id, bad shape or newer `schemaVersion` throw {@link BackupValidationError}. No migration at
 * or below the current version: added fields are optional with defaults. */
export async function parseBackupFile(deps: AppDeps, raw: string): Promise<BackupFile> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new BackupValidationError('Not a valid backup file (invalid JSON).');
  }

  const subjectShape = await deps.subject.settings.loadBackupShape();
  const result = backupFileSchema(subjectShape).safeParse(json);
  if (!result.success || result.data.app !== deps.app.backupAppId) {
    throw new BackupValidationError('Not a valid backup file.');
  }

  // zod's inferred shape and the hand-written `BackupFile` type are structurally close but not
  // identical (mutable vs readonly arrays) — safe to assert since the schema mirrors every field.
  const file = result.data as unknown as BackupFile;
  const current = schemaVersion(deps);
  if (file.schemaVersion > current) {
    throw new BackupValidationError(
      'This backup was made with a newer version of the app. Update the app, then try again.',
    );
  }
  for (const data of Object.values(file.data)) {
    if (!isValidProfileSettings(deps.subject.settings, data.settings)) {
      throw new BackupValidationError('Not a valid backup file.');
    }
  }

  return file;
}
