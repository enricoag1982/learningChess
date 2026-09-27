import type { BotLevel } from './bot/levels.ts';

/** `'auto'` = "Automatic level"; a number fixes it to that `BotLevel.level`, preselected and no
 * longer auto-suggested. */
export type ComputerLevelSetting = 'auto' | BotLevel['level'];

/** Board piece look. */
export type PieceStyleSetting = 'animal' | 'classic';

/** Per-profile parent settings. `null` = daily limit off. */
export interface ProfileSettings {
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
  readonly computerLevel: ComputerLevelSetting;
  readonly pieceStyle: PieceStyleSetting;
  /** ISO instant of the last change, set by `app/settings.ts`'s `updateProfileSettings`. Absent =
   * "missing = oldest" in `domain/merge.ts`'s settings merge; both absent keeps the local side. */
  readonly updatedAt?: string;
}

/** Daily limit choices: off, or 15/20/30/45/60 minutes. Reused for the weekend limit. */
export const DAILY_LIMIT_OPTIONS: readonly (number | null)[] = [null, 15, 20, 30, 45, 60];

/** "Play until" choices: off, or a fixed evening cutoff. */
export const PLAY_UNTIL_OPTIONS: readonly (string | null)[] = [
  null,
  '18:00',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

/** "Not before" choices: off, or a fixed morning start. */
export const PLAY_FROM_OPTIONS: readonly (string | null)[] = [null, '07:00', '08:00', '09:00'];

/** A brand-new profile's settings, and the fallback for one with none stored yet. No
 * `weekendLimitMinutes`/`playUntil`/`playFrom` — every optional field defaults to absent. */
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  dailyLimitMinutes: null,
  voice: true,
  sound: true,
  hints: true,
  computerLevel: 'auto',
  pieceStyle: 'animal',
};

/** `true` for any of {@link DAILY_LIMIT_OPTIONS}. */
export function isValidDailyLimit(value: number | null): boolean {
  return DAILY_LIMIT_OPTIONS.includes(value);
}

/** `true` for `undefined` (absent = same as `dailyLimitMinutes`) or any of {@link DAILY_LIMIT_OPTIONS}. */
export function isValidWeekendLimit(value: number | null | undefined): boolean {
  return value === undefined || isValidDailyLimit(value);
}

/** `true` for `undefined`/`null` (off) or any of {@link PLAY_UNTIL_OPTIONS}. */
export function isValidPlayUntil(value: string | null | undefined): boolean {
  return value === undefined || PLAY_UNTIL_OPTIONS.includes(value);
}

/** `true` for `undefined`/`null` (off) or any of {@link PLAY_FROM_OPTIONS}. */
export function isValidPlayFrom(value: string | null | undefined): boolean {
  return value === undefined || PLAY_FROM_OPTIONS.includes(value);
}

/** `true` for `'auto'` or a real `BotLevel.level` (1–5). */
export function isValidComputerLevel(value: unknown): value is ComputerLevelSetting {
  return value === 'auto' || (typeof value === 'number' && value >= 1 && value <= 5);
}

/** `true` for `'animal'` or `'classic'`. */
export function isValidPieceStyle(value: unknown): value is PieceStyleSetting {
  return value === 'animal' || value === 'classic';
}

/** `true` when every field of `settings` is a valid, in-range value. */
export function isValidProfileSettings(settings: ProfileSettings): boolean {
  return (
    isValidDailyLimit(settings.dailyLimitMinutes) &&
    isValidWeekendLimit(settings.weekendLimitMinutes) &&
    isValidPlayUntil(settings.playUntil) &&
    isValidPlayFrom(settings.playFrom) &&
    typeof settings.voice === 'boolean' &&
    typeof settings.sound === 'boolean' &&
    typeof settings.hints === 'boolean' &&
    isValidComputerLevel(settings.computerLevel) &&
    isValidPieceStyle(settings.pieceStyle)
  );
}
