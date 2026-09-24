import type { CompiledContent, ContentSource } from '@chess-kids/core';
import bundled from '@chess-kids/content/content.json';

/**
 * The only place the raw JSON import is treated as `CompiledContent`: the content build
 * validates the data against that shape (invalid content fails `pnpm build`), so this is a type
 * conversion, not a runtime check.
 */
const content = bundled as unknown as CompiledContent;

/** `ContentSource` over the content package's build-time compiled bundle. */
export function createBundledContentSource(): ContentSource {
  const lessonsById = new Map(content.lessons.map((lesson) => [lesson.id, lesson]));
  const minigamesById = new Map(content.minigames.map((minigame) => [minigame.id, minigame]));

  return {
    lessons: () => content.lessons,
    lesson: (id: string) => lessonsById.get(id),
    minigames: () => content.minigames,
    minigame: (id: string) => minigamesById.get(id),
  };
}
