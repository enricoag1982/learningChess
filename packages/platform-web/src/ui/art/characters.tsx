import type { JSX } from 'react';
import { usePack } from '../../app/subject.ts';
import { animalImage } from './animal-images.ts';

/** Decorative animal artwork: callers give the accessible name, so `alt=""` and never draggable. */
function AnimalImg({
  id,
  subjectArt,
}: {
  readonly id: string;
  readonly subjectArt?: Readonly<Record<string, string>>;
}): JSX.Element {
  return (
    <img
      src={animalImage(id, subjectArt)}
      alt=""
      draggable={false}
      className="h-full w-full object-contain"
    />
  );
}

/** Character portrait by lesson-character id (`docs/app-structure.md` §8): the pack's `art` first, else the platform's own. */
export function CharacterIcon({ character }: { readonly character: string }): JSX.Element {
  const pack = usePack();
  return <AnimalImg id={character} subjectArt={pack.art} />;
}

export function OwlIcon(): JSX.Element {
  return <AnimalImg id="owl" />;
}
