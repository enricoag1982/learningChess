// Golden snapshot (docs/refactor-v4.md R0 "Golden snapshot of compiled content.json"): every dist
// output, pretty-printed for reviewable diffs. These files change ONLY when content or the build
// pipeline changes on purpose — a v4 refactor PR (docs/refactor-v4.md R2-R4, "content snapshot
// equal") must leave every one of them byte-identical. A mismatch means either a real content/build
// change (review the diff, then update with the command below) or an accidental behaviour change
// (fix the code instead). To update after a deliberate change:
//   pnpm --filter @chess-kids/content exec vitest run -u
// then review the diff under src/__snapshots__/content/ before committing it.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileAll } from './compile-all.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const compiled = compileAll(packageDir);

const UPDATE_HINT = 'pnpm --filter @chess-kids/content exec vitest run -u, then review the diff';

/** Pretty-printed (`JSON.stringify(v, null, 1)`, one-space indent) so a content diff stays reviewable. */
function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 1)}\n`;
}

function snapshotPath(...segments: readonly string[]): string {
  return join('__snapshots__', 'content', ...segments);
}

describe('content snapshot (docs/refactor-v4.md R0)', () => {
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
    await expect(pretty(compiled.botBook)).toMatchFileSnapshot(
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
    // Same shape `scripts/voice-texts.ts` writes to dist/voice-texts.json: `{ key, text, source }`
    // only, entries already sorted by key (`buildVoiceInventory`'s own contract).
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
