import {
  changePassword,
  checkPassword,
  isValidPassword,
  newParentLock,
} from '../domain/parent-lock.ts';
import { newProfile, validateNickname } from '../domain/profile.ts';
import type { Profile } from '../domain/profile.ts';
import type { AppDeps } from './use-cases.ts';

export async function isFirstRun(deps: AppDeps): Promise<boolean> {
  const lock = await deps.parentLock.get();
  return lock === undefined;
}

export interface PasswordFileLocation {
  readonly location: string;
}

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

/** Rewrites the code file (lost first copy) and remembers the new location for the "Forgot it?" hint. */
export async function downloadParentCodeFile(deps: AppDeps): Promise<PasswordFileLocation> {
  const lock = await deps.parentLock.get();
  if (!lock) {
    throw new Error('no parent code set up yet');
  }
  const { location } = await deps.passwordFile.write(lock.password);
  await deps.parentLock.save({
    ...lock,
    fileLocation: location,
    updatedAt: deps.clock.now().toISOString(),
  });
  return { location };
}

export interface VerifyPasswordResult {
  readonly ok: boolean;
  readonly waitMs: number;
}

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

export async function listProfiles(deps: AppDeps): Promise<Profile[]> {
  return deps.profiles.list();
}

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

/** Removes the profile and its saved records; clears `lastProfileId` when it was the last-used profile. */
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

/** Parent "Reset child": clears progress, attempts, concept stats, mini-game progress, game records, badges, streak and
 * session log; keeps the profile, assessment results and unlocks (the UI confirms with the password). */
export async function resetProfileData(deps: AppDeps, profileId: string): Promise<void> {
  await requireProfile(deps, profileId);
  await deps.progress.deleteProfileData(profileId);
  await deps.gameRecords.deleteProfileData(profileId);
  await deps.rewards?.deleteProfileData(profileId);
}

export async function selectProfile(deps: AppDeps, profileId: string): Promise<void> {
  const settings = await deps.settings.get();
  await deps.settings.save({ ...settings, lastProfileId: profileId });
}
