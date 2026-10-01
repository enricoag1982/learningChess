// Microsoft Fluent Emoji 3D (MIT) artwork, copied into `assets/art/` with readable names; imported
// as TS so Vite hashes/precaches each file instead of inlining base64.
import elephant from '../../assets/art/elephant.webp';
import owl from '../../assets/art/owl.webp';
import fox from '../../assets/art/fox.webp';
import bear from '../../assets/art/bear.webp';
import rabbit from '../../assets/art/rabbit.webp';
import cat from '../../assets/art/cat.webp';
import panda from '../../assets/art/panda.webp';
import penguin from '../../assets/art/penguin.webp';
import frog from '../../assets/art/frog.webp';

/** The images the platform itself draws, by id: the Owl guide and the profile avatars. A subject's own art goes in its pack's `art`. */
export const ANIMAL_IMAGES = {
  elephant,
  owl,
  fox,
  bear,
  rabbit,
  cat,
  panda,
  penguin,
  frog,
} as const;

/** `subjectArt` (the pack's `art`) first, else the platform's own; the fox for an unknown id (defensive only). */
export function animalImage(id: string, subjectArt: Readonly<Record<string, string>> = {}): string {
  return (
    subjectArt[id] ?? (ANIMAL_IMAGES as Record<string, string | undefined>)[id] ?? ANIMAL_IMAGES.fox
  );
}
