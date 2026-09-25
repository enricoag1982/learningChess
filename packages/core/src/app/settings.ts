import { DEFAULT_PROFILE_SETTINGS, isValidProfileSettings } from '../domain/profile-settings.ts';
import type { ProfileSettings } from '../domain/profile-settings.ts';
import type { AppDeps } from './use-cases.ts';

/**
 * A profile's parent-set settings (domain-model.md §1 `Settings`, app-structure.md §11), or
 * {@link DEFAULT_PROFILE_SETTINGS} if the parent has never changed any of them. Always full/valid:
 * merges the stored (possibly partial, from an older build) entry over the defaults field by field,
 * rather than trusting a stored record's own shape wholesale.
 */
export async function getProfileSettings(
  deps: AppDeps,
  profileId: string,
): Promise<ProfileSettings> {
  const settings = await deps.settings.get();
  const stored = settings.profileSettings[profileId];
  return stored === undefined
    ? DEFAULT_PROFILE_SETTINGS
    : { ...DEFAULT_PROFILE_SETTINGS, ...stored };
}

/**
 * Parent area "Settings per child": merges `patch` into this profile's current settings and
 * persists it. Voice/sound/hints/computer level take effect immediately — the next time the
 * profile is selected (`app-structure.md` §11's own "Settings effect now"); the daily limit is
 * only stored until M5.2 enforces it; piece style is only stored until M5.3 applies it.
 */
export async function updateProfileSettings(
  deps: AppDeps,
  profileId: string,
  patch: Partial<ProfileSettings>,
): Promise<ProfileSettings> {
  const current = await getProfileSettings(deps, profileId);
  const updated: ProfileSettings = {
    ...current,
    ...patch,
    // M7.2 device sharing: stamped on every save so `domain/merge.ts`'s settings merge can tell
    // which device changed a setting more recently ("newest wins").
    updatedAt: deps.clock.now().toISOString(),
  };
  if (!isValidProfileSettings(updated)) {
    throw new Error('invalid profile settings');
  }
  const settings = await deps.settings.get();
  await deps.settings.save({
    ...settings,
    profileSettings: { ...settings.profileSettings, [profileId]: updated },
  });
  return updated;
}
