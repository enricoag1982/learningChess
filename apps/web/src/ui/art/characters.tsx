import type { JSX } from 'react';
import { animalImage } from './animal-images.ts';

/** Decorative animal artwork: every caller already gives the image its accessible name, so the
 * `<img>` itself is `alt=""` and never draggable. */
function AnimalImg({ id }: { readonly id: string }): JSX.Element {
  return (
    <img src={animalImage(id)} alt="" draggable={false} className="h-full w-full object-contain" />
  );
}

/** Character portrait, keyed by lesson-character id (`docs/app-structure.md` §8); falls back to
 * the fox image for an unknown id. */
export function CharacterIcon({ character }: { readonly character: string }): JSX.Element {
  return <AnimalImg id={character} />;
}

/** The narrator's avatar everywhere a speech bubble appears. */
export function OwlIcon(): JSX.Element {
  return <AnimalImg id="owl" />;
}
