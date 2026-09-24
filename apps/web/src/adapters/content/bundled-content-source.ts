import type { BadgeDef, CompiledContent, ContentSource, TracksCatalog } from '@chess-kids/core';
import bundled from '@chess-kids/content/content.json';
import bundledTracks from '@chess-kids/content/tracks.json';
import bundledBadges from '@chess-kids/content/badges.json';

/**
 * The only place the raw JSON import is treated as `CompiledContent`: the content build
 * validates the data against that shape (invalid content fails `pnpm build`), so this is a type
 * conversion, not a runtime check.
 */
const content = bundled as unknown as CompiledContent;

/** Same conversion as `content` above, for `packages/content/tracks.yaml`'s compiled output. */
const tracks = bundledTracks as unknown as TracksCatalog;

/** Same conversion as `content` above, for `packages/content/badges.yaml`'s compiled output. */
const badges = bundledBadges as unknown as BadgeDef[];

/** `ContentSource` over the content package's build-time compiled bundle. */
export function createBundledContentSource(): ContentSource {
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
