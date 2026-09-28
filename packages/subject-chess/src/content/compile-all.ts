import { join } from 'node:path';
import type { BadgeDef, CompiledContent, TracksCatalog } from '@learn/platform-core';
import { loadBadges } from '@learn/platform-content/badges-load';
import {
  ContentError,
  compareToReference,
  loadLocales,
  mergeLocales,
  type Locales,
} from '@learn/platform-content/load';
import { loadContent } from './lesson-load.ts';
import type { SubjectContent } from '@learn/platform-content/subject';
import { loadTracks } from './tracks-load.ts';
import { buildVoiceInventory, type VoiceInventory } from '@learn/platform-content/voice-texts';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';

/** Every value `scripts/build.ts` and `scripts/voice-texts.ts` write to `dist/`, computed once. `C`
 * is the subject's own concrete content bundle (chess: exercises/demos with real board positions),
 * inferred from the caller's own declared type — same idiom as `loadContent`'s own `C`. */
export interface CompiledAll<C extends CompiledContent = CompiledContent> {
  /** Per-language, per-namespace locale trees — one `dist/locales/<lang>.json` per key. */
  readonly locales: Locales;
  readonly content: C;
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
export function compileAll<C extends CompiledContent = CompiledContent>(
  packageDir: string,
  extraOutputs: Readonly<Record<string, (root: string) => unknown>>,
  subject: SubjectContent,
): CompiledAll<C> {
  const localesDir = PLATFORM_LOCALES_DIR;
  const chessLocalesDir = join(packageDir, 'locales');
  const lessonsDir = join(packageDir, 'lessons');
  const minigamesDir = join(packageDir, 'minigames');
  const tracksPath = join(packageDir, 'tracks.yaml');
  const badgesPath = join(packageDir, 'badges.yaml');

  const locales = mergeLocales(loadLocales(localesDir), loadLocales(chessLocalesDir));

  const referenceIssues = compareToReference(locales);
  if (referenceIssues.length > 0) {
    throw new ContentError(referenceIssues);
  }

  const content = loadContent<C>(lessonsDir, minigamesDir, locales, subject);
  const tracks = loadTracks(tracksPath, locales, content.minigames, content.lessons);
  const resolvedExtraOutputs = Object.fromEntries(
    Object.entries(extraOutputs).map(([name, build]) => [name, build(packageDir)]),
  );
  const badges = loadBadges(
    badgesPath,
    locales,
    tracks,
    content.lessons,
    content.minigames,
    subject.badges,
  );
  const voiceTexts = buildVoiceInventory(locales, content, tracks, badges, subject);

  return { locales, content, tracks, extraOutputs: resolvedExtraOutputs, badges, voiceTexts };
}
