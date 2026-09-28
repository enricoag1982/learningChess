/**
 * Writes `packages/content/dist/voice-texts.json` (`[{ key, text, source }]`) from
 * `src/voice-texts.ts`'s `buildVoiceInventory`, and prints its report (count per source, skipped
 * templates, total characters) — read that report before running `tools/voice/generate.py` on the
 * output. See `src/voice-texts.ts`'s own doc comment for what is (and isn't) inventoried and why.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BadgeDef, TracksCatalog } from '@learn/platform-core';
import type { CompiledContent } from '../src/chess.ts';
import { loadBadges } from '@learn/platform-content/badges-load';
import { chessContent } from '../src/content/chess-content.ts';
import {
  ContentError,
  loadLocales,
  mergeLocales,
  type Locales,
} from '@learn/platform-content/load';
import { loadContent } from '@learn/platform-content/lesson-load';
import { loadTracks } from '@learn/platform-content/tracks-load';
import { buildVoiceInventory } from '@learn/platform-content/voice-texts';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const contentDir = join(packageDir, 'content');
const localesDir = PLATFORM_LOCALES_DIR;
const chessLocalesDir = join(contentDir, 'locales');
const lessonsDir = join(contentDir, 'lessons');
const minigamesDir = join(contentDir, 'minigames');
const tracksPath = join(contentDir, 'tracks.yaml');
const badgesPath = join(contentDir, 'badges.yaml');
const outPath = join(packageDir, 'dist', 'voice-texts.json');

function fail(issues: readonly string[]): never {
  for (const issue of issues) console.error(issue);
  process.exit(1);
}

let locales: Locales;
try {
  locales = mergeLocales(loadLocales(localesDir), loadLocales(chessLocalesDir));
} catch (error) {
  if (error instanceof ContentError) fail(error.issues);
  throw error;
}

let content: CompiledContent;
try {
  content = loadContent(lessonsDir, minigamesDir, locales, chessContent);
} catch (error) {
  if (error instanceof ContentError) fail(error.issues);
  throw error;
}

let catalog: TracksCatalog;
try {
  catalog = loadTracks(tracksPath, locales, content.minigames, content.lessons);
} catch (error) {
  if (error instanceof ContentError) fail(error.issues);
  throw error;
}

let badges: readonly BadgeDef[];
try {
  badges = loadBadges(
    badgesPath,
    locales,
    catalog,
    content.lessons,
    content.minigames,
    chessContent.badges,
  );
} catch (error) {
  if (error instanceof ContentError) fail(error.issues);
  throw error;
}

const { entries, skipped } = buildVoiceInventory(locales, content, catalog, badges, chessContent);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(entries.map(({ key, text, source }) => ({ key, text, source }))),
  'utf8',
);

const bySource = new Map<string, number>();
let totalChars = 0;
for (const entry of entries) {
  bySource.set(entry.source, (bySource.get(entry.source) ?? 0) + 1);
  totalChars += entry.text.length;
}

console.log(`voice-texts: ${String(entries.length)} unique text(s) → dist/voice-texts.json`);
for (const [source, count] of [...bySource.entries()].sort()) {
  console.log(`  ${source}: ${String(count)}`);
}
console.log(`voice-texts: ${String(totalChars)} total character(s)`);
if (skipped.length > 0) {
  console.log(`voice-texts: ${String(skipped.length)} skipped template(s):`);
  for (const entry of skipped) {
    console.log(`  ${entry.source}: ${entry.reason}`);
  }
}
