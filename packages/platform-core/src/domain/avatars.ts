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
