import type { AppDeps } from './use-cases.ts';

/** This device's random id (`AppSettings.deviceId`), created lazily on first need (session-log write or merge import) and
 * reused; `deps.ids.next()` needs no new port. */
export async function getOrCreateDeviceId(deps: AppDeps): Promise<string> {
  const settings = await deps.settings.get();
  if (settings.deviceId !== undefined) {
    return settings.deviceId;
  }
  const deviceId = deps.ids.next();
  await deps.settings.save({ ...settings, deviceId });
  return deviceId;
}
