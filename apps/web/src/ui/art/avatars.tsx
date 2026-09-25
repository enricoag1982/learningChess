import type { JSX } from 'react';
import { animalImage } from './animal-images.ts';

/** Renders the Fluent Emoji 3D image for `avatar` (`animal-images.ts`), decorative (`alt=""`):
 * every caller already names it (`aria-label`/`role="img"` wrapper, or a text label alongside).
 * Falls back to the fox image for an unknown id (`animal-images.test.ts` checks every real
 * `Avatar` resolves). */
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
