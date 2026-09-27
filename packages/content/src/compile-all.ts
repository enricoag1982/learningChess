import { join } from 'node:path';
import type { BadgeDef, bot, CompiledContent, TracksCatalog } from '@chess-kids/core';
import { loadBadges } from './badges-load.ts';
import { loadBotBook } from './bot-book-load.ts';
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
  readonly botBook: bot.BotBook;
  readonly badges: readonly BadgeDef[];
  /** `dist/voice-texts.json`'s own source (`scripts/voice-texts.ts` writes just its `entries`). */
  readonly voiceTexts: VoiceInventory;
}

/** Runs the whole content pipeline in memory — `scripts/build.ts`'s own compile steps, extracted so
 * both that script and `content-snapshot.test.ts` share one implementation. */
export function compileAll(packageDir: string): CompiledAll {
  const localesDir = join(packageDir, 'locales');
  const lessonsDir = join(packageDir, 'lessons');
  const minigamesDir = join(packageDir, 'minigames');
  const tracksPath = join(packageDir, 'tracks.yaml');
  const botBookPath = join(packageDir, 'bot-book.yaml');
  const badgesPath = join(packageDir, 'badges.yaml');

  const locales = loadLocales(localesDir);

  const referenceIssues = compareToReference(locales);
  if (referenceIssues.length > 0) {
    throw new ContentError(referenceIssues);
  }

  const content = loadContent(lessonsDir, minigamesDir, locales);
  const tracks = loadTracks(tracksPath, locales, content.minigames, content.lessons);
  const botBook = loadBotBook(botBookPath);
  const badges = loadBadges(badgesPath, locales, tracks, content.lessons, content.minigames);
  const voiceTexts = buildVoiceInventory(locales, content, tracks, badges);

  return { locales, content, tracks, botBook, badges, voiceTexts };
}
