/** Subject-independent settings; `dailyLimitMinutes: null` = limit off. */
export interface ProfileSettingsBase {
  /** "Every day" limit once the weekend toggle is off, else the school-days (Mon–Fri) limit. */
  readonly dailyLimitMinutes: number | null;
  /** Sat/Sun limit (device-local weekday). Absent = same as `dailyLimitMinutes`; `null` is a real
   * choice ("off" for weekends specifically). */
  readonly weekendLimitMinutes?: number | null;
  /** Allowed-hours window: `'HH:MM'` (local, device time zone). `playUntil` = latest allowed time,
   * `playFrom` = earliest; `null` or absent = that edge is off. */
  readonly playUntil?: string | null;
  readonly playFrom?: string | null;
  readonly voice: boolean;
  readonly sound: boolean;
  readonly hints: boolean;
  /** ISO instant of the last change, set by `app/settings.ts`'s `updateProfileSettings`. Absent =
   * "missing = oldest" in `domain/merge.ts`'s settings merge; both absent keeps the local side. */
  readonly updatedAt?: string;
}

/** Base plus the subject's own fields (chess: `computerLevel`) via module augmentation. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented by the subject.
export interface ProfileSettings extends ProfileSettingsBase {}

export const DAILY_LIMIT_OPTIONS: readonly (number | null)[] = [null, 15, 20, 30, 45, 60];

export const PLAY_UNTIL_OPTIONS: readonly (string | null)[] = [
  null,
  '18:00',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

export const PLAY_FROM_OPTIONS: readonly (string | null)[] = [null, '07:00', '08:00', '09:00'];

/** Platform-only defaults; a subject's fields come from its settings slot ({@link composeDefaultSettings}). */
export const DEFAULT_PROFILE_SETTINGS_BASE: ProfileSettingsBase = {
  dailyLimitMinutes: null,
  voice: true,
  sound: true,
  hints: true,
};

export function isValidDailyLimit(value: number | null): boolean {
  return DAILY_LIMIT_OPTIONS.includes(value);
}

export function isValidWeekendLimit(value: number | null | undefined): boolean {
  return value === undefined || isValidDailyLimit(value);
}

export function isValidPlayUntil(value: string | null | undefined): boolean {
  return value === undefined || PLAY_UNTIL_OPTIONS.includes(value);
}

export function isValidPlayFrom(value: string | null | undefined): boolean {
  return value === undefined || PLAY_FROM_OPTIONS.includes(value);
}

/** {@link DEFAULT_PROFILE_SETTINGS_BASE} plus `subject.defaults`, spread right after `hints` — the
 * same key order `app/backup.ts`'s zod shape splices its own subject fields at. */
export function composeDefaultSettings(subject: {
  readonly defaults: Readonly<Record<string, unknown>>;
}): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS_BASE, ...subject.defaults } as ProfileSettings;
}

/** `settings` minus the subject's retired fields (`SubjectCore.settings.retired`). */
export function dropRetiredSettings<T extends object>(
  subject: { readonly retired?: readonly string[] },
  settings: T,
): T {
  const copy = { ...settings };
  for (const key of subject.retired ?? []) Reflect.deleteProperty(copy, key);
  return copy;
}

export function isValidProfileSettings(
  subject: { readonly isValid: (s: Readonly<Record<string, unknown>>) => boolean },
  settings: ProfileSettings,
): boolean {
  return (
    isValidDailyLimit(settings.dailyLimitMinutes) &&
    isValidWeekendLimit(settings.weekendLimitMinutes) &&
    isValidPlayUntil(settings.playUntil) &&
    isValidPlayFrom(settings.playFrom) &&
    typeof settings.voice === 'boolean' &&
    typeof settings.sound === 'boolean' &&
    typeof settings.hints === 'boolean' &&
    // Same bridge `kinds/` uses to hand a subject its own def back out of a base type.
    subject.isValid(settings as unknown as Readonly<Record<string, unknown>>)
  );
}
