/**
 * `pnpm voice:check` (`docs/voice.md`): rebuilds the voice inventory in memory — same content, same
 * `buildVoiceInventory` as `scripts/voice-texts.ts`, without writing `dist/voice-texts.json` — and
 * compares its keys against `apps/web/public/audio/en/manifest.json`'s own `entries`. CI's own guard
 * against a content/UI change that added narrated text but forgot to regenerate its audio.
 *
 * Fails (exit 1) on any inventory key with no manifest entry: exactly the case
 * `tools/voice/generate.py` exists to fix. Warns (exit 0, does not fail) on an orphan manifest entry
 * (a key no longer in the inventory) — `generate.py`'s own next run prunes those files itself.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BadgeDef, CompiledContent, TracksCatalog } from '@chess-kids/core';
import { loadBadges } from '../src/badges-load.ts';
import { ContentError, loadLocales, type Locales } from '../src/load.ts';
import { loadContent } from '../src/lesson-load.ts';
import { loadTracks } from '../src/tracks-load.ts';
import { buildVoiceInventory } from '../src/voice-texts.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageDir, '..', '..');
const localesDir = join(packageDir, 'locales');
const lessonsDir = join(packageDir, 'lessons');
const minigamesDir = join(packageDir, 'minigames');
const tracksPath = join(packageDir, 'tracks.yaml');
const badgesPath = join(packageDir, 'badges.yaml');
const manifestPath = join(repoRoot, 'apps', 'web', 'public', 'audio', 'en', 'manifest.json');

function fail(issues: readonly string[]): never {
  for (const issue of issues) console.error(issue);
  process.exit(1);
}

let locales: Locales;
try {
  locales = loadLocales(localesDir);
} catch (error) {
  if (error instanceof ContentError) fail(error.issues);
  throw error;
}

let content: CompiledContent;
try {
  content = loadContent(lessonsDir, minigamesDir, locales);
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
  badges = loadBadges(badgesPath, locales, catalog, content.lessons, content.minigames);
} catch (error) {
  if (error instanceof ContentError) fail(error.issues);
  throw error;
}

const { entries } = buildVoiceInventory(locales, content, catalog, badges);

interface VoiceManifest {
  readonly entries?: Readonly<Record<string, { readonly text?: string }>>;
}

let manifest: VoiceManifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as VoiceManifest;
} catch (error) {
  console.error(`voice:check: could not read ${manifestPath} (${String(error)}).`);
  console.error('voice:check: run `pnpm voice:generate`.');
  process.exit(1);
}

const manifestKeys = new Set(Object.keys(manifest.entries ?? {}));
const inventoryKeys = new Set(entries.map((entry) => entry.key));
const missing = entries.filter((entry) => !manifestKeys.has(entry.key));
const orphans = [...manifestKeys].filter((key) => !inventoryKeys.has(key));

if (orphans.length > 0) {
  console.warn(
    `voice:check: ${String(orphans.length)} orphan audio file(s) in the manifest (no longer in ` +
      'the inventory — `tools/voice/generate.py` prunes these on its next run):',
  );
  for (const key of orphans) {
    console.warn(`  ${key}: ${manifest.entries?.[key]?.text ?? '(no text recorded)'}`);
  }
}

if (missing.length > 0) {
  console.error(
    `voice:check: ${String(missing.length)} inventory text(s) have no generated audio — run ` +
      '`pnpm voice:generate`:',
  );
  for (const entry of missing) {
    console.error(`  ${entry.key}: ${entry.text}`);
  }
  process.exit(1);
}

console.log(
  `voice:check: ${String(entries.length)} inventory text(s), every one has generated audio.`,
);
