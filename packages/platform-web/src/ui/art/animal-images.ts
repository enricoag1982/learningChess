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
import mouse from '../../assets/art/mouse.webp';
import wolf from '../../assets/art/wolf.webp';

/** Every animal image this app ships, by id (the Owl guide, avatars, bot levels); `animal-images.test.ts` checks each module's ids resolve here. */
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
  mouse,
  wolf,
} as const;

/** `subjectArt` (the pack's `art`) first, else the platform's own; the fox for an unknown id (defensive only). */
export function animalImage(id: string, subjectArt: Readonly<Record<string, string>> = {}): string {
  return (
    subjectArt[id] ?? (ANIMAL_IMAGES as Record<string, string | undefined>)[id] ?? ANIMAL_IMAGES.fox
  );
}

/** Pastel badge colour per lesson character (the piece characters keep the tints their animals had). */
const CHARACTER_COLOR: Readonly<Record<string, string>> = {
  rook: '#DCE3D9',
  bishop: '#DCE3EA',
  queen: '#FBE3D2',
  king: '#FBEFD3',
  knight: '#F1E4C8',
  pawn: '#DCEFE3',
};

export function characterColor(character: string): string {
  return CHARACTER_COLOR[character] ?? '#E9DFF3';
}
