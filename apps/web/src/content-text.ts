import type { TFunction } from 'i18next';

/** Translates a key loaded from `packages/content` (dynamic YAML/JSON, not a TS literal), the one
 * intentional boundary where `t()`'s literal-key typo-safety is relaxed. */
export function tContent(
  t: TFunction,
  key: string,
  options?: Readonly<Record<string, unknown>>,
): string {
  const dynamic = t as unknown as (k: string, opts?: Readonly<Record<string, unknown>>) => string;
  return dynamic(key, options);
}

/** Display name for a lesson character, e.g. `characters:rhino.name` → "Rhino". */
export function characterName(t: TFunction, character: string): string {
  return tContent(t, `characters:${character}.name`);
}

/** Display name for a profile avatar, e.g. `avatar.fox` → "Fox". */
export function avatarName(t: TFunction, avatar: string): string {
  return tContent(t, `avatar.${avatar}`);
}
