import type { Avatar } from '@learn/platform-core';
import { AVATARS } from '@learn/platform-core';

export { AVATARS };
export type { Avatar };

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

export function avatarBackground(avatar: string): string {
  return (AVATAR_BACKGROUND as Record<string, string | undefined>)[avatar] ?? AVATAR_BACKGROUND.fox;
}
