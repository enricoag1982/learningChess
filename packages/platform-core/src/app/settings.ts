import { composeDefaultSettings, isValidProfileSettings } from '../domain/profile-settings.ts';
import type { ProfileSettings } from '../domain/profile-settings.ts';
import type { AppDeps } from './use-cases.ts';

/** A profile's parent-set settings, or its subject's composed defaults if never changed. Always
 * full/valid: merges the stored (possibly partial) entry over the defaults field by field. */
export async function getProfileSettings(
  deps: AppDeps,
  profileId: string,
): Promise<ProfileSettings> {
  const settings = await deps.settings.get();
  const stored = settings.profileSettings[profileId];
  const defaults = composeDefaultSettings(deps.subject.settings);
  return stored === undefined ? defaults : { ...defaults, ...stored };
}

/** Parent area "Settings per child": merges `patch` into this profile's current settings and
 * persists it. Voice/sound/hints/computer level take effect the next time the profile is selected. */
export async function updateProfileSettings(
  deps: AppDeps,
  profileId: string,
  patch: Partial<ProfileSettings>,
): Promise<ProfileSettings> {
  const current = await getProfileSettings(deps, profileId);
  const updated: ProfileSettings = {
    ...current,
    ...patch,
    // Stamped on every save so `domain/merge.ts`'s settings merge can tell which device is newer.
    updatedAt: deps.clock.now().toISOString(),
  };
  if (!isValidProfileSettings(deps.subject.settings, updated)) {
    throw new Error('invalid profile settings');
  }
  const settings = await deps.settings.get();
  await deps.settings.save({
    ...settings,
    profileSettings: { ...settings.profileSettings, [profileId]: updated },
  });
  return updated;
}
