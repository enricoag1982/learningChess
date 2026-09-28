/** Chess's own settings slot fields, added to `ProfileSettings` via module augmentation so the
 * rest of the app keeps reading them straight off a profile's settings. */
export type ComputerLevelSetting = 'auto' | 1 | 2 | 3 | 4 | 5;

/** Board piece look. */
export type PieceStyleSetting = 'animal' | 'classic';

declare module '@learn/platform-core/domain/profile-settings' {
  interface ProfileSettings {
    /** `'auto'` = "Automatic level", preselected and no longer auto-suggested; a number fixes it
     * to that bot level (1 Mouse .. 5 Bear). */
    readonly computerLevel: ComputerLevelSetting;
    readonly pieceStyle: PieceStyleSetting;
  }
}

/** Chess's own settings-slot defaults, spread into `composeDefaultSettings`'s result. */
export const CHESS_SETTINGS_DEFAULTS: {
  readonly computerLevel: ComputerLevelSetting;
  readonly pieceStyle: PieceStyleSetting;
} = {
  computerLevel: 'auto',
  pieceStyle: 'animal',
};

/** `true` for `'auto'` or a real `BotLevel.level` (1–5). */
export function isValidComputerLevel(value: unknown): value is ComputerLevelSetting {
  return value === 'auto' || (typeof value === 'number' && value >= 1 && value <= 5);
}

/** `true` for `'animal'` or `'classic'`. */
export function isValidPieceStyle(value: unknown): value is PieceStyleSetting {
  return value === 'animal' || value === 'classic';
}
