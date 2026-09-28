import type { BadgeDef, TracksCatalog } from '@learn/platform-core';
import type { CompiledContent } from '../../../chess.ts';
import bundled from '../../../../dist/content.json';
import bundledTracks from '../../../../dist/tracks.json';
import bundledBadges from '../../../../dist/badges.json';

/** The content build validates this shape (invalid content fails `pnpm build`), so this is a type
 * conversion, not a runtime check. */
const content = bundled as unknown as CompiledContent;

/** Same conversion as `content` above, for `packages/content/tracks.yaml`'s compiled output. */
const tracks = bundledTracks as unknown as TracksCatalog;

/** Same conversion as `content` above, for `packages/content/badges.yaml`'s compiled output. */
const badges = bundledBadges as unknown as BadgeDef[];

/** `ContentSource` over the content package's build-time compiled bundle, at chess's own concrete
 * shapes — widens to the platform's base `ContentSource` with no cast (`app/ports.ts`). */
export function createBundledContentSource() {
  const lessonsById = new Map(content.lessons.map((lesson) => [lesson.id, lesson]));
  const minigamesById = new Map(content.minigames.map((minigame) => [minigame.id, minigame]));

  return {
    lessons: () => content.lessons,
    lesson: (id: string) => lessonsById.get(id),
    minigames: () => content.minigames,
    minigame: (id: string) => minigamesById.get(id),
    catalog: () => tracks,
    badges: () => badges,
  };
}

export type ChessContentSource = ReturnType<typeof createBundledContentSource>;
