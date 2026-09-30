/** Chess's own settings slot fields, added to `ProfileSettings` via module augmentation so the
 * rest of the app keeps reading them straight off a profile's settings. */
export type ComputerLevelSetting = 'auto' | 1 | 2 | 3 | 4 | 5;

declare module '@learn/platform-core/domain/profile-settings' {
  interface ProfileSettings {
    /** `'auto'` = "Automatic level", preselected and no longer auto-suggested; a number fixes it
     * to that bot level (1 Mouse .. 5 Bear). */
    readonly computerLevel: ComputerLevelSetting;
  }
}

export const CHESS_SETTINGS_DEFAULTS: { readonly computerLevel: ComputerLevelSetting } = {
  computerLevel: 'auto',
};

/** Written by v1.0.0 to v2.0.0 (the animal-badge "Piece style"); still loads, is ignored and dropped on the next save. */
export const CHESS_RETIRED_SETTINGS: readonly string[] = ['pieceStyle'];

/** Exported for a v1.0.0-v2.0.0 install, whose backup import still requires the field; never read back. */
export const CHESS_LEGACY_EXPORT: Readonly<Record<string, unknown>> = { pieceStyle: 'classic' };

export function isValidComputerLevel(value: unknown): value is ComputerLevelSetting {
  return value === 'auto' || (typeof value === 'number' && value >= 1 && value <= 5);
}
