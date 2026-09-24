import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import { ContentError, compareToReference, loadLocales, type Locales } from '../src/load.ts';
import { loadContent } from '../src/lesson-load.ts';
import { loadTracks } from '../src/tracks-load.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const localesDir = join(packageDir, 'locales');
const lessonsDir = join(packageDir, 'lessons');
const minigamesDir = join(packageDir, 'minigames');
const tracksPath = join(packageDir, 'tracks.yaml');
const distDir = join(packageDir, 'dist', 'locales');
const contentPath = join(packageDir, 'dist', 'content.json');
const tracksOutPath = join(packageDir, 'dist', 'tracks.json');

function fail(issues: readonly string[]): never {
  for (const issue of issues) {
    console.error(issue);
  }
  process.exit(1);
}

let locales: Locales;
try {
  locales = loadLocales(localesDir);
} catch (error) {
  if (error instanceof ContentError) {
    fail(error.issues);
  }
  throw error;
}

const referenceIssues = compareToReference(locales);
if (referenceIssues.length > 0) {
  fail(referenceIssues);
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const namespaceNames = new Set<string>();
for (const [lang, namespaces] of Object.entries(locales)) {
  for (const name of Object.keys(namespaces)) {
    namespaceNames.add(name);
  }
  await writeFile(join(distDir, `${lang}.json`), JSON.stringify(namespaces), 'utf8');
}

const languageCount = Object.keys(locales).length;
console.log(
  `content: ${String(languageCount)} language(s), ${String(namespaceNames.size)} namespace(s) → dist/locales`,
);

let content: CompiledContent;
try {
  content = loadContent(lessonsDir, minigamesDir, locales);
} catch (error) {
  if (error instanceof ContentError) {
    fail(error.issues);
  }
  throw error;
}

await writeFile(contentPath, JSON.stringify(content), 'utf8');
console.log(
  `content: ${String(content.lessons.length)} lesson(s), ${String(content.minigames.length)} mini-game(s) → dist/content.json`,
);

let tracks: TracksCatalog;
try {
  tracks = loadTracks(tracksPath, locales);
} catch (error) {
  if (error instanceof ContentError) {
    fail(error.issues);
  }
  throw error;
}

await writeFile(tracksOutPath, JSON.stringify(tracks), 'utf8');
console.log(
  `content: ${String(tracks.tracks.length)} track(s), ${String(tracks.ranks.length)} rank(s) → dist/tracks.json`,
);
