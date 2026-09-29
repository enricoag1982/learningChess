import type { BadgeDef, TracksCatalog } from '@learn/platform-core';
import type { MathContent } from '../../../core/types.ts';
import bundled from '../../../../dist/content.json';
import bundledTracks from '../../../../dist/tracks.json';
import bundledBadges from '../../../../dist/badges.json';

/** The content build validates this shape (invalid content fails `pnpm build`), so this is a type
 * conversion, not a runtime check. */
const content = bundled as unknown as MathContent;

/** Same conversion as `content`, for the compiled tracks. */
const tracks = bundledTracks as unknown as TracksCatalog;

/** Same conversion as `content`, for the compiled badges. */
const badges = bundledBadges as unknown as BadgeDef[];

/** `ContentSource` over the build-time compiled bundle at math's concrete shapes; widens to the platform's base `ContentSource` with no cast. */
export function createMathContentSource() {
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
