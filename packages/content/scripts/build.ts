import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { bot } from '@chess-kids/core/chess';
import { loadBotBook } from '../src/bot-book-load.ts';
import { chessContent } from '../src/chess-content.ts';
import { compileAll } from '../src/compile-all.ts';
import { ContentError } from '../src/load.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageDir, 'dist', 'locales');
const contentPath = join(packageDir, 'dist', 'content.json');
const tracksOutPath = join(packageDir, 'dist', 'tracks.json');
const botBookOutPath = join(packageDir, 'dist', 'bot-book.json');
const badgesOutPath = join(packageDir, 'dist', 'badges.json');

function fail(issues: readonly string[]): never {
  for (const issue of issues) {
    console.error(issue);
  }
  process.exit(1);
}

let compiled: ReturnType<typeof compileAll>;
try {
  compiled = compileAll(
    packageDir,
    { 'bot-book.json': (root) => loadBotBook(join(root, 'bot-book.yaml')) },
    chessContent,
  );
} catch (error) {
  if (error instanceof ContentError) {
    fail(error.issues);
  }
  throw error;
}

const { locales, content, tracks, badges } = compiled;
const botBook = compiled.extraOutputs['bot-book.json'] as bot.BotBook;

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

await writeFile(contentPath, JSON.stringify(content), 'utf8');
console.log(
  `content: ${String(content.lessons.length)} lesson(s), ${String(content.minigames.length)} mini-game(s) → dist/content.json`,
);

await writeFile(tracksOutPath, JSON.stringify(tracks), 'utf8');
console.log(
  `content: ${String(tracks.tracks.length)} track(s), ${String(tracks.ranks.length)} rank(s) → dist/tracks.json`,
);

await writeFile(botBookOutPath, JSON.stringify(botBook), 'utf8');
console.log(`content: ${String(botBook.lines.length)} opening line(s) → dist/bot-book.json`);

await writeFile(badgesOutPath, JSON.stringify(badges), 'utf8');
console.log(`content: ${String(badges.length)} badge(s) → dist/badges.json`);
