import type { AppDeps } from './use-cases.ts';

/**
 * This device's own random id (M7.2 device sharing, `AppSettings.deviceId`), created once, lazily,
 * the first time it is needed — a local session-log write (`app/rewards.ts`'s
 * `recordSessionMinutes`, `app/time-limit.ts`'s `grantExtraTime`/`grantHoursOverride`/
 * `markTimeWarning`) or a "Send to other device" export (`app/merge.ts`'s `exportForSharing`) —
 * and reused forever after. `deps.ids.next()` (the same UUID generator every other record uses) is
 * random enough and needs no new port.
 */
export async function getOrCreateDeviceId(deps: AppDeps): Promise<string> {
  const settings = await deps.settings.get();
  if (settings.deviceId !== undefined) {
    return settings.deviceId;
  }
  const deviceId = deps.ids.next();
  await deps.settings.save({ ...settings, deviceId });
  return deviceId;
}
