import type { JSX } from 'react';
import { avatarBackground } from '../art/avatar-meta.ts';
import { AvatarIcon } from '../art/avatars.tsx';

export interface AvatarBadgeProps {
  readonly avatar: string;
  readonly className: string;
  /** Given: a real `<div role="img" aria-label={label}>` (avatar stands alone). Omitted: a plain
   * decorative `<span>` (sits beside its own name/label). */
  readonly label?: string;
}

export function AvatarBadge({ avatar, className, label }: AvatarBadgeProps): JSX.Element {
  const Tag = label === undefined ? 'span' : 'div';
  return (
    <Tag
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      className={className}
      style={{ backgroundColor: avatarBackground(avatar) }}
    >
      <AvatarIcon avatar={avatar} />
    </Tag>
  );
}
