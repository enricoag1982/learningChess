import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Offline size budget (non-functional.md §4): initial JS ≤ 300 KB gzipped. Sums the gzip size of
 * every built JS asset (the app's one entry chunk today; still correct if it's ever code-split)
 * and fails the build if the total goes over budget.
 */
const BUDGET_BYTES = 300 * 1024;

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '../dist/assets');
const jsFiles = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));

if (jsFiles.length === 0) {
  throw new Error(`no .js files found in ${assetsDir} — run the build first`);
}

let totalBytes = 0;
for (const file of jsFiles) {
  const bytes = gzipSync(readFileSync(join(assetsDir, file))).length;
  totalBytes += bytes;
  console.log(`  ${file}: ${(bytes / 1024).toFixed(1)} KB gzip`);
}

const totalKb = (totalBytes / 1024).toFixed(1);
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);
console.log(`Total JS: ${totalKb} KB gzip (budget ${budgetKb} KB)`);

if (totalBytes > BUDGET_BYTES) {
  throw new Error(`size budget exceeded: ${totalKb} KB > ${budgetKb} KB`);
}
