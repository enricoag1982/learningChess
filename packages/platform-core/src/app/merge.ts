import type { MergeableProfileData } from '../domain/merge.ts';
import {
  emptyProfileData,
  mergeProfileData,
  rekeyProfileData,
  totalMinutesOverDays,
} from '../domain/merge.ts';
import { composeDefaultSettings } from '../domain/profile-settings.ts';
import type { Profile } from '../domain/profile.ts';
import { totalStars } from '../domain/progress.ts';
import type { BackupFile, ProfileBackupData } from './backup.ts';
import { buildBackupFile, requireBackupImporter } from './backup.ts';
import { getOrCreateDeviceId } from './device.ts';
import type { AppDeps } from './use-cases.ts';

/** One incoming child's chosen fate: `'add-new'` creates a fresh local profile from the incoming
 * one (id kept — only applies when it matches no local profile); `'merge'` combines its data into
 * `localProfileId` (re-keyed first when that id differs). */
export interface ChildImportChoice {
  readonly incomingProfileId: string;
  readonly kind: 'add-new' | 'merge';
  readonly localProfileId?: string;
}

/** One incoming child's import-preview row (`app/merge.ts`'s `planImport`). */
export interface ChildImportPlan {
  readonly incomingProfile: Profile;
  /** `true`: this incoming child's id already matches a local profile — merges automatically, no
   * choice control shown. */
  readonly autoMerge: boolean;
  readonly defaultChoice: ChildImportChoice;
  /** Every local profile, for the "Merge into …" control's own options; `[]` on a fresh device. */
  readonly localProfiles: readonly Profile[];
}

/** The whole import preview (`app/merge.ts`'s `planImport`): one row per incoming child. */
export interface ImportPlan {
  readonly incomingFile: BackupFile;
  readonly children: readonly ChildImportPlan[];
}

/** Case-insensitive, trimmed nickname key, for preselecting a merge target by nickname match. */
function nicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase();
}

/** Parent area "Import" preview: for each incoming child, whether it merges automatically (same
 * profile id already exists locally) or needs a choice, defaulting to a nickname match else "Add
 * as new child". Read-only: touches no storage. */
export async function planImport(deps: AppDeps, incomingFile: BackupFile): Promise<ImportPlan> {
  const localProfiles = await deps.profiles.list();
  const localById = new Map(localProfiles.map((profile) => [profile.id, profile]));
  const localByNickname = new Map(
    localProfiles.map((profile) => [nicknameKey(profile.nickname), profile] as const),
  );

  const children: ChildImportPlan[] = incomingFile.profiles.map((incomingProfile) => {
    if (localById.has(incomingProfile.id)) {
      return {
        incomingProfile,
        autoMerge: true,
        defaultChoice: {
          incomingProfileId: incomingProfile.id,
          kind: 'merge',
          localProfileId: incomingProfile.id,
        },
        localProfiles,
      };
    }
    const nicknameMatch = localByNickname.get(nicknameKey(incomingProfile.nickname));
    const defaultChoice: ChildImportChoice =
      nicknameMatch === undefined
        ? { incomingProfileId: incomingProfile.id, kind: 'add-new' }
        : {
            incomingProfileId: incomingProfile.id,
            kind: 'merge',
            localProfileId: nicknameMatch.id,
          };
    return { incomingProfile, autoMerge: false, defaultChoice, localProfiles };
  });

  return { incomingFile, children };
}

/** Days the "+N min this week" preview figure covers — same window the Overview's own "minutes
 * this week" card uses (`app/report.ts`'s `OVERVIEW_MINUTES_DAYS`). */
const PREVIEW_MINUTES_DAYS = 7;

/** What choosing `choice` would change for one incoming child (import preview's "+12 stars, +3
 * badges, +45 min this week" line). */
export interface ImportChangeSummary {
  readonly starsDelta: number;
  readonly badgesDelta: number;
  readonly minutesThisWeekDelta: number;
}

const NO_CHANGE: ImportChangeSummary = { starsDelta: 0, badgesDelta: 0, minutesThisWeekDelta: 0 };

/** Computes {@link ImportChangeSummary} for one incoming child under `choice`, against this
 * device's current stored data (read fresh each call). `'add-new'`: every incoming number.
 * `'merge'`: the merged result vs. what `localProfileId` has today. */
export async function previewChildChange(
  deps: AppDeps,
  incomingFile: BackupFile,
  choice: ChildImportChoice,
): Promise<ImportChangeSummary> {
  const incomingData = incomingFile.data[choice.incomingProfileId];
  if (incomingData === undefined) return NO_CHANGE;
  const now = deps.clock.now();

  if (choice.kind === 'add-new') {
    return {
      starsDelta: totalStars(incomingData.lessonProgress),
      badgesDelta: incomingData.earnedBadges.length,
      minutesThisWeekDelta: totalMinutesOverDays(incomingData, now, PREVIEW_MINUTES_DAYS),
    };
  }

  if (choice.localProfileId === undefined) return NO_CHANGE;
  const localFile = await buildBackupFile(deps, [choice.localProfileId]);
  const localData: MergeableProfileData =
    localFile.data[choice.localProfileId] ??
    emptyProfileData(composeDefaultSettings(deps.subject.settings));
  const rekeyed =
    choice.localProfileId === choice.incomingProfileId
      ? incomingData
      : rekeyProfileData(incomingData, choice.localProfileId);
  const merged = mergeProfileData(localData, rekeyed, now);

  return {
    starsDelta: totalStars(merged.lessonProgress) - totalStars(localData.lessonProgress),
    badgesDelta: merged.earnedBadges.length - localData.earnedBadges.length,
    minutesThisWeekDelta:
      totalMinutesOverDays(merged, now, PREVIEW_MINUTES_DAYS) -
      totalMinutesOverDays(localData, now, PREVIEW_MINUTES_DAYS),
  };
}

/** Which local profile id (if any) `incoming` merges into, given `choice` (or its absence — the
 * same nickname-match default `planImport` offers). `null` = "add as new child". A same-id match
 * always wins over `choice`. */
function resolveMergeTarget(
  incoming: Profile,
  choice: ChildImportChoice | undefined,
  localIds: ReadonlySet<string>,
  localByNickname: ReadonlyMap<string, string>,
): string | null {
  if (localIds.has(incoming.id)) return incoming.id;
  if (choice === undefined) return localByNickname.get(nicknameKey(incoming.nickname)) ?? null;
  if (choice.kind === 'add-new') return null;
  return choice.localProfileId ?? localByNickname.get(nicknameKey(incoming.nickname)) ?? null;
}

/** Outcome of {@link importMerged}: the device's totals after the import. */
export interface ImportMergedResult {
  readonly profileCount: number;
  readonly totalStars: number;
}

/** Parent area "Merge": folds `incomingFile`'s children into this device's current, full dataset
 * per `choices` (falling back to {@link planImport}'s default), and atomically writes the result.
 * Idempotent end to end: importing the same file twice changes nothing further. */
export async function importMerged(
  deps: AppDeps,
  incomingFile: BackupFile,
  choices: readonly ChildImportChoice[] = [],
): Promise<ImportMergedResult> {
  const importer = requireBackupImporter(deps);
  const now = deps.clock.now();
  const [localFile, deviceSettings, localDeviceId] = await Promise.all([
    buildBackupFile(deps),
    deps.settings.get(),
    getOrCreateDeviceId(deps),
  ]);

  const profiles: Profile[] = [...localFile.profiles];
  const data: Record<string, ProfileBackupData> = { ...localFile.data };
  const localIds = new Set(profiles.map((profile) => profile.id));
  const localByNickname = new Map(
    profiles.map((profile) => [nicknameKey(profile.nickname), profile.id] as const),
  );
  const choiceByIncomingId = new Map(
    choices.map((choice) => [choice.incomingProfileId, choice] as const),
  );

  for (const incomingProfile of incomingFile.profiles) {
    const incomingData = incomingFile.data[incomingProfile.id];
    if (incomingData === undefined) continue;

    const targetId = resolveMergeTarget(
      incomingProfile,
      choiceByIncomingId.get(incomingProfile.id),
      localIds,
      localByNickname,
    );

    if (targetId === null) {
      profiles.push(incomingProfile);
      localIds.add(incomingProfile.id);
      localByNickname.set(nicknameKey(incomingProfile.nickname), incomingProfile.id);
      data[incomingProfile.id] = incomingData;
      continue;
    }

    const localData: MergeableProfileData =
      data[targetId] ?? emptyProfileData(composeDefaultSettings(deps.subject.settings));
    const rekeyed =
      targetId === incomingProfile.id ? incomingData : rekeyProfileData(incomingData, targetId);
    data[targetId] = mergeProfileData(localData, rekeyed, now);
  }

  const mergedFile: BackupFile = {
    app: deps.app.backupAppId,
    schemaVersion: localFile.schemaVersion,
    exportedAt: now.toISOString(),
    profiles,
    data,
  };

  if (importer.writeMerged === undefined) {
    throw new Error('AppDeps.backupImporter.writeMerged is not wired up');
  }
  await importer.writeMerged(mergedFile, { localDeviceId, deviceSettings });

  const totalStarsAll = profiles.reduce(
    (sum, profile) => sum + totalStars(data[profile.id]?.lessonProgress ?? []),
    0,
  );
  return { profileCount: profiles.length, totalStars: totalStarsAll };
}
