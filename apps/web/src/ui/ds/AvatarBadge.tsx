import type { JSX } from 'react';
import { avatarBackground } from '../art/avatar-meta.ts';
import { AvatarIcon } from '../art/avatars.tsx';

export interface AvatarBadgeProps {
  /** Animal avatar id, e.g. `fox` (`Profile.avatar`'s own type: a plain `string`). */
  readonly avatar: string;
  readonly className: string;
  /** Given: a real `<div role="img" aria-label={label}>` (the avatar stands alone, e.g. Home's
   * header). Omitted: a plain decorative `<span>` (the avatar sits beside its own name/label, or
   * inside an already-labelled control). */
  readonly label?: string;
}

/** A profile's avatar in its tinted circle — one shape written out 11 times across kid and parent
 * screens (refactor-v4.md §2 finding 6). */
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
