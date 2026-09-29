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
