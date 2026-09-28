/**
 * Builds the content (`buildContent` writes `dist/voice-texts.json`, `[{ key, text, source }]`, from
 * `platform-content`'s `buildVoiceInventory`) and prints the voice report (count per source,
 * skipped templates, total characters) — read that report before running `tools/voice/generate.py`
 * on the output. See `platform-content/src/voice-texts.ts`'s own doc comment for what is (and
 * isn't) inventoried and why.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, exitOnContentError } from '@learn/platform-content/build';
import { chessContent } from '../src/content/chess-content.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { voiceTexts } = await buildContent({
  subject: chessContent,
  root: join(packageDir, 'content'),
  out: join(packageDir, 'dist'),
}).catch(exitOnContentError);
const { entries, skipped } = voiceTexts;

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
