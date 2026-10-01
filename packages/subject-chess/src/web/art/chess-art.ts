// Chess-only art: the bot levels no profile avatar uses, and the piece-character badge tints.
import { animalImage } from '@learn/platform-web/ui/art/animal-images.ts';
import mouse from './mouse.webp';
import wolf from './wolf.webp';

/** The pack's `art`: bot-level images the platform doesn't ship (rabbit, fox and bear are avatars, so they stay there). */
export const CHESS_ART = { mouse, wolf } as const;

/** A bot level's image: the pack's own, else the platform's. */
export function botImage(level: string): string {
  return animalImage(level, CHESS_ART);
}

/** Pastel badge colour per piece character (the tints their animals had). */
const CHARACTER_COLOR: Readonly<Record<string, string>> = {
  rook: '#DCE3D9',
  bishop: '#DCE3EA',
  queen: '#FBE3D2',
  king: '#FBEFD3',
  knight: '#F1E4C8',
  pawn: '#DCEFE3',
};

export function characterColor(character: string): string | undefined {
  return CHARACTER_COLOR[character];
}
