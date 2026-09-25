import { z } from 'zod';
import { DEFAULT_PROFILE_SETTINGS, isValidProfileSettings } from '../domain/profile-settings.ts';
import { localDayString } from '../domain/streak.ts';
import type { AssessmentResult, Unlock } from '../domain/assessment.ts';
import type { EarnedBadge } from '../domain/badges.ts';
import type { ProfileSettings } from '../domain/profile-settings.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import type { BackupFileWriter, BackupImporter } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

// No `new Function` fast path: the production CSP (`script-src 'self'`, M5.4) would report zod's
// eval probe as a violation. Set before any schema below is built (object schemas read it at init).
z.config({ jitless: true });

/**
 * One profile's full backed-up data (M5.1, app-structure.md §11/§12, `docs/non-functional.md` §3
 * "export each profile's data"): every stored record this app keeps for a child, except its
 * `Profile` row itself (kept alongside, once, in `BackupFile.profiles`) and the parent password
 * (`ParentLockRepository` — a backup never carries it, see `BackupImporter`'s own doc).
 */
export interface ProfileBackupData {
  readonly settings: ProfileSettings;
  readonly lessonProgress: readonly LessonProgress[];
  readonly attempts: readonly Attempt[];
  readonly miniGameProgress: readonly MiniGameProgress[];
  readonly conceptStats: readonly ConceptStats[];
  readonly gameRecords: readonly GameRecord[];
  readonly earnedBadges: readonly EarnedBadge[];
  readonly streak?: Streak;
  readonly sessionLogs: readonly SessionLog[];
  readonly assessmentResults: readonly AssessmentResult[];
  readonly unlocks: readonly Unlock[];
}

/**
 * The backup file itself (M5.1 decision: `{ app, schemaVersion, exportedAt, profiles[], data by
 * profile }`), one JSON file for either every profile on the device ("Export") or a single one
 * ("Export per child" — same format, `profiles`/`data` just hold the one). `data` is keyed by
 * profile id so `parent.export-child`'s output is a trivial filter of `parent.export-all`'s own.
 */
export interface BackupFile {
  readonly app: 'chess-kids';
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

const profileSettingsSchema = z.object({
  dailyLimitMinutes: z.number().nullable(),
  voice: z.boolean(),
  sound: z.boolean(),
  hints: z.boolean(),
  computerLevel: z.union([z.literal('auto'), z.number().int().min(1).max(5)]),
  pieceStyle: z.union([z.literal('animal'), z.literal('classic')]),
});

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

const profileBackupDataSchema = z.object({
  settings: profileSettingsSchema,
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

/** Shape-only validation (`docs/architecture.md` §11 M5.1): every field type here already matches
 * the live domain interfaces, so a successful parse is safe to treat as a real {@link BackupFile}. */
const backupFileSchema = z.object({
  app: z.literal('chess-kids'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  profiles: z.array(profileSchema),
  data: z.record(z.string(), profileBackupDataSchema),
});

/** Raised on a backup file that fails validation (corrupt JSON, wrong shape, or a newer schema
 * version than this build supports) — the parent-area Import UI shows `message` and changes nothing. */
export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

/** `deps.backupFileWriter`, or a clear error if this `AppDeps` has not wired it up. */
function requireBackupFileWriter(deps: AppDeps): BackupFileWriter {
  if (deps.backupFileWriter === undefined) {
    throw new Error('AppDeps.backupFileWriter is not wired up');
  }
  return deps.backupFileWriter;
}

/** `deps.backupImporter`, or a clear error if this `AppDeps` has not wired it up. */
function requireBackupImporter(deps: AppDeps): BackupImporter {
  if (deps.backupImporter === undefined) {
    throw new Error('AppDeps.backupImporter is not wired up');
  }
  return deps.backupImporter;
}

/** `deps.storageSchemaVersion`, or `1` (the earliest possible) if this `AppDeps` predates it — a
 * fixture never wiring backup up at all never calls `buildBackupFile` in the first place. */
function schemaVersion(deps: AppDeps): number {
  return deps.storageSchemaVersion ?? 1;
}

/** One profile's own backed-up data, read straight off the repository ports (`buildBackupFile`). */
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
    deps.settings.get().then((all) => all.profileSettings[profileId] ?? DEFAULT_PROFILE_SETTINGS),
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

/**
 * Builds a {@link BackupFile} for `profileIds` (every profile on the device when omitted) — the
 * parent area's "Export" (every child) and "Export per child" (`profileIds: [id]`) both call this,
 * same format either way (M5.1 decision).
 */
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
    app: 'chess-kids',
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

/**
 * `chess-kids-backup-<date>.json`, or `chess-kids-backup-<nickname>-<date>.json` for a per-child
 * export (M5.1 decision: same format, own filename for clarity when several sit in Downloads).
 */
export function backupFileName(now: Date, nickname?: string): string {
  const date = localDayString(now);
  const nicknameSlug = nickname === undefined ? '' : slug(nickname);
  return nicknameSlug === ''
    ? `chess-kids-backup-${date}.json`
    : `chess-kids-backup-${nicknameSlug}-${date}.json`;
}

/**
 * Parent area "Export" / "Export per child": builds the backup file and writes it via
 * `deps.backupFileWriter` (web: triggers a download). `profileIds: [id]` for a per-child export —
 * its filename carries that one profile's nickname when it resolves to exactly one.
 */
export async function exportBackup(deps: AppDeps, profileIds?: readonly string[]): Promise<void> {
  const file = await buildBackupFile(deps, profileIds);
  // Whether the filename carries a nickname depends on which call this is ("export all" vs
  // "export this child"), not on how many profiles the result happens to hold — a device with
  // only one child must still get the same "export all" filename shape as one with several.
  const nickname = profileIds?.length === 1 ? file.profiles[0]?.nickname : undefined;
  const filename = backupFileName(deps.clock.now(), nickname);
  await requireBackupFileWriter(deps).write(filename, JSON.stringify(file, null, 2));
}

/**
 * Validates `raw` (a backup file's text contents) into a {@link BackupFile} — corrupt JSON, a
 * wrong `app` id, a bad shape, or `schemaVersion` newer than this build's own
 * (`deps.storageSchemaVersion`) all throw {@link BackupValidationError} with a clear message;
 * nothing else is touched (parent area "invalid file = clear error, nothing changed"). A
 * `schemaVersion` at or below the current one needs no data migration: every field this app has
 * ever added to these records is optional with a sensible default when absent (the same "read an
 * older record back as the default" approach `apps/web/src/adapters/storage/migrations.ts` already
 * uses for every migration to date), so an older, valid backup parses straight into this same type.
 */
export function parseBackupFile(deps: AppDeps, raw: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new BackupValidationError('Not a valid backup file (invalid JSON).');
  }

  const result = backupFileSchema.safeParse(json);
  if (!result.success) {
    throw new BackupValidationError('Not a valid backup file.');
  }

  // The zod-inferred shape and the hand-written `BackupFile` domain type are structurally close
  // but not identical (mutable vs `readonly` arrays, zod's own optional-field inference) — safe to
  // assert through `unknown` since `backupFileSchema` mirrors every field `BackupFile` declares.
  const file = result.data as unknown as BackupFile;
  const current = schemaVersion(deps);
  if (file.schemaVersion > current) {
    throw new BackupValidationError(
      'This backup was made with a newer version of the app. Update the app, then try again.',
    );
  }
  for (const data of Object.values(file.data)) {
    if (!isValidProfileSettings(data.settings)) {
      throw new BackupValidationError('Not a valid backup file.');
    }
  }

  return file;
}

/** The parent-area Import preview text's own numbers ("2 children, 1,234 stars"). */
export interface BackupSummary {
  readonly profileCount: number;
  readonly totalStars: number;
}

function lessonStarsSum(bestStars: Readonly<Record<string, 1 | 2 | 3>>): number {
  return Object.values(bestStars).reduce((sum: number, stars) => sum + stars, 0);
}

/** `{ profileCount, totalStars }` for `file` — every profile's stars, exercises + boss, summed. */
export function backupSummary(file: BackupFile): BackupSummary {
  const totalStars = Object.values(file.data).reduce((sum, data) => {
    const lessonTotal = data.lessonProgress.reduce(
      (lessonSum, progress) => lessonSum + lessonStarsSum(progress.bestStars) + progress.bossStars,
      0,
    );
    return sum + lessonTotal;
  }, 0);
  return { profileCount: file.profiles.length, totalStars };
}

/**
 * Parent area "Import": validates `raw` (throws {@link BackupValidationError} on anything invalid,
 * changing nothing), then atomically replaces every stored profile/progress/reward/assessment
 * record with `raw`'s own (`deps.backupImporter`, "never partial"). Returns the preview summary so
 * the UI can show what was restored.
 */
export async function importBackup(deps: AppDeps, raw: string): Promise<BackupSummary> {
  const file = parseBackupFile(deps, raw);
  await requireBackupImporter(deps).replaceAll(file);
  return backupSummary(file);
}
