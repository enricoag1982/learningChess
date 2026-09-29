// Golden snapshot: every dist output, pretty-printed for reviewable diffs. A mismatch is either a real change
// (review the diff, update with the `UPDATE_HINT` command) or an accidental behaviour change (fix the code).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mathContent } from './math-content.ts';
import { compileAll } from '@learn/platform-content/compile-all';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const compiled = compileAll(mathContent, packageDir);

const UPDATE_HINT =
  'pnpm --filter @learn/subject-math exec vitest run src/content/content-snapshot.test.ts -u, then review the diff';

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

  it('badges.json', async () => {
    await expect(pretty(compiled.badges)).toMatchFileSnapshot(
      snapshotPath('badges.json'),
      UPDATE_HINT,
    );
  });

  it('voice-texts.json', async () => {
    // Same shape the build writes to dist/voice-texts.json.
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
