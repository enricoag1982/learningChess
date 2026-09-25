// Microsoft Fluent Emoji 3D (MIT) artwork, copied from `@lobehub/fluent-emoji-3d` (MIT) into
// `apps/web/src/assets/art/` with readable names (docs/roadmap.md §7 "Illustrations") — never imported from
// the npm package itself (not a dependency). Imported as TS so Vite hashes/precaches each file and
// `vite.config.ts`'s `assetsInlineLimit` keeps them as real files, never inlined base64 in JS.
// `lioness.webp` has no source emoji: derived from `lion.webp` by `tools/art/make-lioness.py`
// (mane removed) — see that script for the method.
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

/** Every animal image this app ships, keyed by id: lesson characters (`character-meta.ts`),
 * profile avatars (`avatar-meta.ts`), and bot levels (`domain/bot/levels.ts`'s `BotLevel.name`).
 * `animal-images.test.ts` checks every id each of those modules actually uses resolves here. */
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
