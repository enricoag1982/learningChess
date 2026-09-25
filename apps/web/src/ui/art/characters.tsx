import type { JSX } from 'react';
import { animalImage } from './animal-images.ts';

/** Decorative animal artwork (Microsoft Fluent Emoji 3D, `animal-images.ts`): every caller already
 * gives the image its accessible name (an `aria-label`/`role="img"` wrapper, or a visible text
 * label next to it), so the `<img>` itself is `alt=""` and never draggable. */
function AnimalImg({ id }: { readonly id: string }): JSX.Element {
  return (
    <img src={animalImage(id)} alt="" draggable={false} className="h-full w-full object-contain" />
  );
}

/** Character portrait, keyed by lesson-character id (`docs/app-structure.md` §8: rhino, elephant,
 * lioness, lion, horse, caterpillar, owl) or the kid's own profile-avatar fox — falls back to the
 * fox image for an unknown id (`animal-images.test.ts` checks every real id resolves). */
export function CharacterIcon({ character }: { readonly character: string }): JSX.Element {
  return <AnimalImg id={character} />;
}

/** The narrator's avatar everywhere a speech bubble appears. */
export function OwlIcon(): JSX.Element {
  return <AnimalImg id="owl" />;
}

/** The kid's own profile avatar. */
export function FoxIcon(): JSX.Element {
  return <AnimalImg id="fox" />;
}
