import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError, compareToReference, loadLocales, type Locales } from '../src/load.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const localesDir = join(packageDir, 'locales');
const distDir = join(packageDir, 'dist', 'locales');

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
