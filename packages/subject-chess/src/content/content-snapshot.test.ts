// Golden snapshot: every dist output, pretty-printed for reviewable diffs. These files change only
// when content or the build pipeline changes on purpose — a mismatch means either a real change
// (review the diff, update with `pnpm --filter @chess-kids/content exec vitest run -u`) or an
// accidental behaviour change (fix the code instead).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadBotBook } from './bot-book-load.ts';
import { chessContent } from './chess-content.ts';
import { compileAll } from './compile-all.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const compiled = compileAll(
  packageDir,
  { 'bot-book.json': (root) => loadBotBook(join(root, 'bot-book.yaml')) },
  chessContent,
);

const UPDATE_HINT = 'pnpm --filter @chess-kids/content exec vitest run -u, then review the diff';

/** Pretty-printed (`JSON.stringify(v, null, 1)`, one-space indent) so a content diff stays reviewable. */
function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 1)}\n`;
}

function snapshotPath(...segments: readonly string[]): string {
  return join('__snapshots__', 'content', ...segments);
}

describe('content snapshot', () => {
  it('content.json', async () => {
    await expect(pretty(compiled.content)).toMatchFileSnapshot(
      snapshotPath('content.json'),
      UPDATE_HINT,
    );
  });

  it('tracks.json', async () => {
    await expect(pretty(compiled.tracks)).toMatchFileSnapshot(
      snapshotPath('tracks.json'),
      UPDATE_HINT,
    );
  });

  it('bot-book.json', async () => {
    await expect(pretty(compiled.extraOutputs['bot-book.json'])).toMatchFileSnapshot(
      snapshotPath('bot-book.json'),
      UPDATE_HINT,
    );
  });

  it('badges.json', async () => {
    await expect(pretty(compiled.badges)).toMatchFileSnapshot(
      snapshotPath('badges.json'),
      UPDATE_HINT,
    );
  });

  it('voice-texts.json', async () => {
    // Same shape `scripts/voice-texts.ts` writes to dist/voice-texts.json.
    const entries = compiled.voiceTexts.entries.map(({ key, text, source }) => ({
      key,
      text,
      source,
    }));
    await expect(pretty(entries)).toMatchFileSnapshot(
      snapshotPath('voice-texts.json'),
      UPDATE_HINT,
    );
  });

  for (const lang of Object.keys(compiled.locales).sort()) {
    it(`locales/${lang}.json`, async () => {
      await expect(pretty(compiled.locales[lang])).toMatchFileSnapshot(
        snapshotPath('locales', `${lang}.json`),
        UPDATE_HINT,
      );
    });
  }
});
