import type { Avatar } from '@chess-kids/core';
import { AVATARS } from '@chess-kids/core';

export { AVATARS };
export type { Avatar };

/** Pastel badge background per avatar, echoing the sketches (Main.dc.html). */
const AVATAR_BACKGROUND: Readonly<Record<Avatar, string>> = {
  fox: '#F9D9C2',
  bear: '#E8DCCB',
  rabbit: '#F1EEE5',
  cat: '#FBEFD3',
  panda: '#E9E9E9',
  penguin: '#DDE8F6',
  frog: '#DCEFE3',
  elephant: '#DDE8F6',
};

/** Background colour for `avatar`, falling back to the fox colour for an unknown id. */
export function avatarBackground(avatar: string): string {
  return (AVATAR_BACKGROUND as Record<string, string | undefined>)[avatar] ?? AVATAR_BACKGROUND.fox;
}
