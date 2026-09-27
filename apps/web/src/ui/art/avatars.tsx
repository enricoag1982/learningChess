import type { JSX } from 'react';
import { animalImage } from './animal-images.ts';

/** Renders the Fluent Emoji 3D image for `avatar`, decorative (`alt=""`): every caller already
 * names it. Falls back to the fox image for an unknown id. */
export function AvatarIcon({ avatar }: { readonly avatar: string }): JSX.Element {
  return (
    <img
      src={animalImage(avatar)}
      alt=""
      draggable={false}
      className="h-full w-full object-contain"
    />
  );
}
