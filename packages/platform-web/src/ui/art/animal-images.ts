// Microsoft Fluent Emoji 3D (MIT) artwork, copied into `assets/art/` with readable names; imported
// as TS so Vite hashes/precaches each file instead of inlining base64.
import rhino from '../../assets/art/rhino.webp';
import elephant from '../../assets/art/elephant.webp';
import lion from '../../assets/art/lion.webp';
import lioness from '../../assets/art/lioness.webp';
import horse from '../../assets/art/horse.webp';
import caterpillar from '../../assets/art/caterpillar.webp';
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

/** Every animal image this app ships, by id (characters, avatars, bot levels); `animal-images.test.ts` checks each module's ids resolve here. */
export const ANIMAL_IMAGES = {
  rhino,
  elephant,
  lion,
  lioness,
  horse,
  caterpillar,
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

/** Pastel badge colour per character, echoing its habitat (animal theme, not chess). */
const CHARACTER_COLOR: Readonly<Record<string, string>> = {
  rhino: '#DCE3D9',
  elephant: '#DCE3EA',
  lioness: '#FBE3D2',
  lion: '#FBEFD3',
  horse: '#F1E4C8',
  caterpillar: '#DCEFE3',
};

export function characterColor(character: string): string {
  return CHARACTER_COLOR[character] ?? '#E9DFF3';
}
