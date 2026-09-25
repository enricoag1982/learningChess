import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Offline size budget (non-functional.md §4): *initial* JS ≤ 300 KB gzipped — the app shell before
 * a kid ever opens a lazy-loaded screen (M5.4: parent area, friend play, placement / test-out —
 * `App.tsx`'s own `React.lazy` calls), not the whole app. `dist/index.html`'s own
 * `<script type="module">` (the entry chunk) plus every `<link rel="modulepreload">` it lists (the
 * entry's own static, non-lazy dependencies — Vite already resolved exactly the set a first paint
 * needs; a chunk only ever reached through a lazy screen's own dynamic `import()` is never listed
 * here) is exactly what a first, cold load actually fetches before Home is interactive. Every
 * other built JS file (the lazy screens' own chunks, the bot worker, …) is reported too, as the
 * grand total, but does not count against the budget — each is precached by the service worker
 * right after first load either way (`vite.config.ts`'s `workbox.globPatterns`), so a repeat visit
 * pays no network cost for it regardless of when it is first fetched.
 */
const BUDGET_BYTES = 300 * 1024;

const distDir = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const assetsDir = join(distDir, 'assets');
const jsFiles = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));

if (jsFiles.length === 0) {
  throw new Error(`no .js files found in ${assetsDir} — run the build first`);
}

/** Every `assets/<file>.js` (or `assets/<file>.js` without the `assets/` prefix, matching
 * either an absolute `/assets/…` or relative `assets/…` href) named in `dist/index.html`, in the
 * order it appears: the entry `<script type="module">` first, then each `<link
 * rel="modulepreload">`. */
function initialChunkNames(html: string): string[] {
  const names: string[] = [];
  const pattern =
    /<(?:script[^>]*\btype="module"|link[^>]*\brel="modulepreload")[^>]*\b(?:src|href)="([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href === undefined) continue;
    const name = href.split('/').pop();
    if (name !== undefined && name.endsWith('.js')) {
      names.push(name);
    }
  }
  return names;
}

const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');
const initialNames = new Set(initialChunkNames(indexHtml));
if (initialNames.size === 0) {
  throw new Error(`no <script type="module">/<link rel="modulepreload"> found in index.html`);
}

let initialBytes = 0;
let totalBytes = 0;
for (const file of jsFiles) {
  const bytes = gzipSync(readFileSync(join(assetsDir, file))).length;
  totalBytes += bytes;
  const isInitial = initialNames.has(file);
  if (isInitial) {
    initialBytes += bytes;
  }
  console.log(`  ${file}: ${(bytes / 1024).toFixed(1)} KB gzip${isInitial ? ' (initial)' : ''}`);
}

const missing = [...initialNames].filter(
  (name) => !jsFiles.includes(name) && !name.includes('registerSW'),
);
if (missing.length > 0) {
  throw new Error(`index.html references JS not found in dist/assets: ${missing.join(', ')}`);
}

const initialKb = (initialBytes / 1024).toFixed(1);
const totalKb = (totalBytes / 1024).toFixed(1);
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);
console.log(`Initial JS: ${initialKb} KB gzip (budget ${budgetKb} KB)`);
console.log(`Total JS (incl. lazy chunks + worker): ${totalKb} KB gzip`);

if (initialBytes > BUDGET_BYTES) {
  throw new Error(`initial JS size budget exceeded: ${initialKb} KB > ${budgetKb} KB`);
}
