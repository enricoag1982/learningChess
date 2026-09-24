import type { TFunction } from 'i18next';

/**
 * Translates a key loaded from `packages/content` (a lesson's `storyKey`/`textKey`, a mini-game's
 * `titleKey`/`goalKey`, …). Those keys are inherently dynamic — read from built YAML/JSON content,
 * not authored as TypeScript literals — so they can't be checked against the literal key union
 * `t()` otherwise enforces for UI strings written directly in this app. This is the one,
 * intentional boundary where that check is relaxed; every other `t()` call in the app keeps the
 * full typo-safety.
 */
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
