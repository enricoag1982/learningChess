import type { BotLevel } from './bot/levels.ts';

/** `'auto'` = "Automatic level" (`docs/computer-opponent.md` §5); a number fixes it to that
 * `BotLevel.level`, preselected and no longer auto-suggested (`docs/app-structure.md` §11). */
export type ComputerLevelSetting = 'auto' | BotLevel['level'];

/** Board piece look (`docs/app-structure.md` §14 "Open"); stored from M5.1, applied in M5.3. */
export type PieceStyleSetting = 'animal' | 'classic';

/**
 * Per-profile parent settings (domain-model.md §1 `Settings`, app-structure.md §11). `null` =
 * daily limit off. `dailyLimitMinutes` is only stored in M5.1 — M5.2 reads it to enforce the
 * limit from the session log (`domain-model.md`'s own field name, fixed by the M5.2 lead's note).
 */
export interface ProfileSettings {
  readonly dailyLimitMinutes: number | null;
  readonly voice: boolean;
  readonly sound: boolean;
  readonly hints: boolean;
  readonly computerLevel: ComputerLevelSetting;
  readonly pieceStyle: PieceStyleSetting;
}

/** Daily limit choices (app-structure.md §11): off, or 15/20/30/45/60 minutes. */
export const DAILY_LIMIT_OPTIONS: readonly (number | null)[] = [null, 15, 20, 30, 45, 60];

/** A brand-new profile's settings, and the fallback for one with none stored yet. */
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
    typeof settings.voice === 'boolean' &&
    typeof settings.sound === 'boolean' &&
    typeof settings.hints === 'boolean' &&
    isValidComputerLevel(settings.computerLevel) &&
    isValidPieceStyle(settings.pieceStyle)
  );
}
