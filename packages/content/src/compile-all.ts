import { join } from 'node:path';
import type { BadgeDef, CompiledContent, TracksCatalog } from '@chess-kids/core';
import { loadBadges } from './badges-load.ts';
import { ContentError, compareToReference, loadLocales, type Locales } from './load.ts';
import { loadContent } from './lesson-load.ts';
import { loadTracks } from './tracks-load.ts';
import { buildVoiceInventory, type VoiceInventory } from './voice-texts.ts';

/** Every value `scripts/build.ts` and `scripts/voice-texts.ts` write to `dist/`, computed once. */
export interface CompiledAll {
  /** Per-language, per-namespace locale trees — one `dist/locales/<lang>.json` per key. */
  readonly locales: Locales;
  readonly content: CompiledContent;
  readonly tracks: TracksCatalog;
  /** The subject's own extra `dist/` outputs, by file name (chess: `'bot-book.json'` ->
   * `bot.BotBook`), supplied by the caller so this file stays subject-free. */
  readonly extraOutputs: Readonly<Record<string, unknown>>;
  readonly badges: readonly BadgeDef[];
  /** `dist/voice-texts.json`'s own source (`scripts/voice-texts.ts` writes just its `entries`). */
  readonly voiceTexts: VoiceInventory;
}

/** Runs the whole content pipeline in memory — `scripts/build.ts`'s own compile steps, extracted so
 * both that script and `content-snapshot.test.ts` share one implementation. `extraOutputs` builds
 * each of the subject's own extra `dist/` files from `packageDir` (chess: `bot-book.json`). */
export function compileAll(
  packageDir: string,
  extraOutputs: Readonly<Record<string, (root: string) => unknown>>,
): CompiledAll {
  const localesDir = join(packageDir, 'locales');
  const lessonsDir = join(packageDir, 'lessons');
  const minigamesDir = join(packageDir, 'minigames');
  const tracksPath = join(packageDir, 'tracks.yaml');
  const badgesPath = join(packageDir, 'badges.yaml');

  const locales = loadLocales(localesDir);

  const referenceIssues = compareToReference(locales);
  if (referenceIssues.length > 0) {
    throw new ContentError(referenceIssues);
  }

  const content = loadContent(lessonsDir, minigamesDir, locales);
  const tracks = loadTracks(tracksPath, locales, content.minigames, content.lessons);
  const resolvedExtraOutputs = Object.fromEntries(
    Object.entries(extraOutputs).map(([name, build]) => [name, build(packageDir)]),
  );
  const badges = loadBadges(badgesPath, locales, tracks, content.lessons, content.minigames);
  const voiceTexts = buildVoiceInventory(locales, content, tracks, badges);

  return { locales, content, tracks, extraOutputs: resolvedExtraOutputs, badges, voiceTexts };
}
