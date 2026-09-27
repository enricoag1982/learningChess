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

/** Every animal image this app ships, keyed by id: lesson characters, profile avatars, and bot
 * levels. `animal-images.test.ts` checks every id each module uses resolves here. */
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

export type AnimalImageId = keyof typeof ANIMAL_IMAGES;

/** Image URL for `id`, falling back to the fox image for an id this module doesn't know (should
 * never happen for a real character/avatar/bot-level id — defensive only). */
export function animalImage(id: string): string {
  return (ANIMAL_IMAGES as Record<string, string | undefined>)[id] ?? ANIMAL_IMAGES.fox;
}
