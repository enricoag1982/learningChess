import {
  changePassword,
  checkPassword,
  isValidPassword,
  newParentLock,
} from '../domain/parent-lock.ts';
import { newProfile, validateNickname } from '../domain/profile.ts';
import type { Profile } from '../domain/profile.ts';
import type { AppDeps } from './use-cases.ts';

/** True until a parent password has been set up (app-structure.md §2: first run sets it). */
export async function isFirstRun(deps: AppDeps): Promise<boolean> {
  const lock = await deps.parentLock.get();
  return lock === undefined;
}

export interface PasswordFileLocation {
  readonly location: string;
}

/** First-run parent password: writes the password file, then saves the lock. */
export async function setupParentPassword(
  deps: AppDeps,
  password: string,
): Promise<PasswordFileLocation> {
  if (!isValidPassword(password)) {
    throw new Error('password must be at least 4 characters');
  }
  const { location } = await deps.passwordFile.write(password);
  const lock = newParentLock(deps.ids.next(), password, location, deps.clock.now());
  await deps.parentLock.save(lock);
  return { location };
}

/** Parent area "Change password": validates, rewrites the file, resets attempts and any lock. */
export async function changeParentPassword(
  deps: AppDeps,
  password: string,
): Promise<PasswordFileLocation> {
  if (!isValidPassword(password)) {
    throw new Error('password must be at least 4 characters');
  }
  const lock = await deps.parentLock.get();
  if (!lock) {
    throw new Error('no parent password set up yet');
  }
  const { location } = await deps.passwordFile.write(password);
  const updated = changePassword(lock, password, location, deps.clock.now());
  await deps.parentLock.save(updated);
  return { location };
}

export interface VerifyPasswordResult {
  readonly ok: boolean;
  /** Milliseconds still to wait before the next attempt; `0` unless a lock is in effect. */
  readonly waitMs: number;
}

/** Checks a parent-area password attempt, persisting the updated attempt/lock state either way. */
export async function verifyParentPassword(
  deps: AppDeps,
  input: string,
): Promise<VerifyPasswordResult> {
  const lock = await deps.parentLock.get();
  if (!lock) {
    return { ok: false, waitMs: 0 };
  }
  const result = checkPassword(lock, input, deps.clock.now());
  await deps.parentLock.save(result.lock);
  return { ok: result.ok, waitMs: result.waitMs };
}

/** Every profile on this device, in repository order (id creation order). */
export async function listProfiles(deps: AppDeps): Promise<Profile[]> {
  return deps.profiles.list();
}

/** Creates a new player profile (new-player wizard: nickname, then avatar). */
export async function createProfile(
  deps: AppDeps,
  nickname: string,
  avatar: string,
): Promise<Profile> {
  if (!validateNickname(nickname)) {
    throw new Error('invalid nickname');
  }
  const profile = newProfile(deps.ids.next(), nickname, avatar, deps.clock.now());
  await deps.profiles.save(profile);
  return profile;
}

async function requireProfile(deps: AppDeps, profileId: string): Promise<Profile> {
  const existing = await deps.profiles.get(profileId);
  if (!existing) {
    throw new Error(`profile "${profileId}" not found`);
  }
  return existing;
}

/** Parent area: renames a child's profile. */
export async function renameProfile(
  deps: AppDeps,
  profileId: string,
  nickname: string,
): Promise<Profile> {
  if (!validateNickname(nickname)) {
    throw new Error('invalid nickname');
  }
  const existing = await requireProfile(deps, profileId);
  const updated: Profile = {
    ...existing,
    nickname: nickname.trim(),
    updatedAt: deps.clock.now().toISOString(),
  };
  await deps.profiles.save(updated);
  return updated;
}

/** Parent area: changes a child's avatar. */
export async function changeAvatar(
  deps: AppDeps,
  profileId: string,
  avatar: string,
): Promise<Profile> {
  const existing = await requireProfile(deps, profileId);
  const updated: Profile = { ...existing, avatar, updatedAt: deps.clock.now().toISOString() };
  await deps.profiles.save(updated);
  return updated;
}

/**
 * Parent area "Delete": removes the profile and every saved lesson-progress/attempt record for
 * it, and clears `lastProfileId` in settings if this was the last-used profile.
 */
export async function deleteProfile(deps: AppDeps, profileId: string): Promise<void> {
  await deps.progress.deleteProfileData(profileId);
  await deps.gameRecords.deleteProfileData(profileId);
  await deps.assessment?.deleteProfileData(profileId);
  await deps.profiles.delete(profileId);
  const settings = await deps.settings.get();
  if (settings.lastProfileId === profileId) {
    await deps.settings.save({ ...settings, lastProfileId: null });
  }
}

/** Records which profile the kid picked, so the picker shows it first next time. */
export async function selectProfile(deps: AppDeps, profileId: string): Promise<void> {
  const settings = await deps.settings.get();
  await deps.settings.save({ ...settings, lastProfileId: profileId });
}
