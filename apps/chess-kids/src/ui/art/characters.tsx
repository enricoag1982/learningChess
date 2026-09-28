import type { JSX } from 'react';
import { usePack } from '../../app/subject.ts';
import { animalImage } from '@learn/platform-web/ui/art/animal-images.ts';

/** Decorative animal artwork: every caller already gives the image its accessible name, so the
 * `<img>` itself is `alt=""` and never draggable. */
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

/** Character portrait, keyed by lesson-character id (`docs/app-structure.md` §8) — the active
 * subject's own art (`pack.art`), falling back to the platform's own for an id it doesn't have. */
export function CharacterIcon({ character }: { readonly character: string }): JSX.Element {
  const pack = usePack();
  return <AnimalImg id={character} subjectArt={pack.art} />;
}

/** The narrator's avatar everywhere a speech bubble appears. */
export function OwlIcon(): JSX.Element {
  return <AnimalImg id="owl" />;
}
