/** Fixed set of animal avatar ids a profile can pick (app-structure.md §8: profile avatars are animals). */
export const AVATARS = [
  'fox',
  'bear',
  'rabbit',
  'cat',
  'panda',
  'penguin',
  'frog',
  'elephant',
] as const;

export type Avatar = (typeof AVATARS)[number];

/** True if `value` is one of the fixed avatar ids. */
export function isAvatar(value: string): value is Avatar {
  return (AVATARS as readonly string[]).includes(value);
}
