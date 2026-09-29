import { statSync } from 'node:fs';
import { join } from 'node:path';
import {
  keySchema,
  langSchema,
  leafKeySchema,
  PLURAL_SUFFIX_PATTERN,
  sortNamespaces,
  textLeafSchema,
  type LocaleTree,
} from './schema.ts';
import { readEntries, readYaml } from './yaml-file.ts';

export type Locales = Record<string, Record<string, LocaleTree>>;

export class ContentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(['invalid content:', ...issues].join('\n'));
    this.name = 'ContentError';
    this.issues = issues;
  }
}

export function loadLocales(localesDir: string): Locales {
  const issues: string[] = [];
  const locales: Locales = {};

  for (const langName of readEntries(localesDir, issues, 'locales directory')) {
    if (!statSync(join(localesDir, langName)).isDirectory()) {
      issues.push(
        `${langName}: unexpected file in locales directory (expected a language directory)`,
      );
      continue;
    }
    if (!langSchema.safeParse(langName).success) {
      issues.push(`${langName}: invalid language directory name`);
      continue;
    }

    locales[langName] = loadLanguage(join(localesDir, langName), langName, issues);
  }

  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return locales;
}

/** Deep-merges the platform's namespace tree with the subject's; a leaf defined by both is a build error. Key order is
 * canonical (inputs pre-sorted, result re-sorted), so the root a key lives in never changes the output. */
function mergeTree(
  platform: LocaleTree,
  subject: LocaleTree,
  path: string,
  issues: string[],
): LocaleTree {
  const result: LocaleTree = { ...platform };
  for (const [key, subjectValue] of Object.entries(subject)) {
    const keyPath = path === '' ? key : `${path}.${key}`;
    const platformValue = result[key];
    if (platformValue === undefined) {
      result[key] = subjectValue;
    } else if (typeof platformValue === 'string' || typeof subjectValue === 'string') {
      issues.push(`locales: "${keyPath}" is defined in both the platform and subject roots`);
    } else {
      result[key] = mergeTree(platformValue, subjectValue, keyPath, issues);
    }
  }
  return result;
}

/** Deep-merges the subject's locales into the platform's per language; a key both roots define throws {@link ContentError}. */
export function mergeLocales(platform: Locales, subject: Locales): Locales {
  const issues: string[] = [];
  const languages = new Set([...Object.keys(platform), ...Object.keys(subject)]);
  const merged: Locales = {};

  for (const lang of languages) {
    const platformNamespaces = platform[lang] ?? {};
    const subjectNamespaces = subject[lang] ?? {};
    const namespaceNames = new Set([
      ...Object.keys(platformNamespaces),
      ...Object.keys(subjectNamespaces),
    ]);
    const namespaces: Record<string, LocaleTree> = {};
    for (const name of namespaceNames) {
      namespaces[name] = mergeTree(
        platformNamespaces[name] ?? {},
        subjectNamespaces[name] ?? {},
        name,
        issues,
      );
    }
    merged[lang] = namespaces;
  }

  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return Object.fromEntries(
    Object.entries(merged).map(([lang, namespaces]) => [lang, sortNamespaces(namespaces)]),
  );
}

function loadLanguage(
  langDir: string,
  langName: string,
  issues: string[],
): Record<string, LocaleTree> {
  const namespaces: Record<string, LocaleTree> = {};

  for (const fileName of readEntries(langDir, issues, `${langName} directory`)) {
    const filePath = join(langDir, fileName);
    const relPath = `${langName}/${fileName}`;

    if (!statSync(filePath).isFile()) {
      issues.push(`${relPath}: unexpected directory (expected a .yaml file)`);
      continue;
    }

    const namespace = fileName.endsWith('.yaml') ? fileName.slice(0, -'.yaml'.length) : '';
    if (namespace === '' || !keySchema.safeParse(namespace).success) {
      issues.push(
        `${relPath}: invalid file name (expected <namespace>.yaml, lowercase kebab-case)`,
      );
      continue;
    }

    const tree = loadNamespace(filePath, relPath, issues);
    if (tree !== undefined) {
      namespaces[namespace] = tree;
    }
  }

  return sortNamespaces(namespaces);
}

function loadNamespace(
  filePath: string,
  relPath: string,
  issues: string[],
): LocaleTree | undefined {
  const read = readYaml(filePath, relPath);
  if ('issues' in read) {
    issues.push(...read.issues);
    return undefined;
  }
  const parsed = read.data;

  if (!isPlainObject(parsed)) {
    issues.push(`${relPath}: root: must be a map of keys to text or nested maps`);
    return undefined;
  }

  return validateNode(parsed, [], relPath, issues);
}

function validateNode(
  node: Record<string, unknown>,
  path: readonly string[],
  relPath: string,
  issues: string[],
): LocaleTree {
  const result: LocaleTree = {};

  for (const [key, child] of Object.entries(node)) {
    const keyPath = [...path, key].join('.');

    // Plural suffixes (`_one`, `_other`, …) are allowed on text leaves only.
    const validKey =
      typeof child === 'string'
        ? leafKeySchema.safeParse(key).success
        : keySchema.safeParse(key).success;
    if (!validKey) {
      issues.push(`${relPath}: ${keyPath}: invalid key name`);
      continue;
    }

    if (typeof child === 'string') {
      if (!textLeafSchema.safeParse(child).success) {
        issues.push(`${relPath}: ${keyPath}: must be a non-empty string`);
        continue;
      }
      result[key] = child;
    } else if (isPlainObject(child)) {
      result[key] = validateNode(child, [...path, key], relPath, issues);
    } else {
      issues.push(`${relPath}: ${keyPath}: must be a non-empty string or a nested map`);
    }
  }

  return result;
}

export function hasKeyPath(tree: LocaleTree, dotPath: string): boolean {
  let node: LocaleTree | string = tree;
  for (const segment of dotPath.split('.')) {
    if (typeof node === 'string') {
      return false;
    }
    const child: LocaleTree | string | undefined = node[segment];
    if (child === undefined) {
      return false;
    }
    node = child;
  }
  return typeof node === 'string';
}

/** Checks that `fullKey` resolves to a leaf in the `en` locale — a pluralized leaf (`<key>_other`)
 * satisfies a plain key too. */
export function checkTextKey(
  fullKey: string,
  locales: Locales,
  where: string,
  issues: string[],
): void {
  const separatorIndex = fullKey.indexOf(':');
  const namespace = separatorIndex < 0 ? '' : fullKey.slice(0, separatorIndex);
  const dotPath = separatorIndex < 0 ? '' : fullKey.slice(separatorIndex + 1);
  const tree = locales.en?.[namespace];
  const resolves =
    tree !== undefined &&
    dotPath !== '' &&
    (hasKeyPath(tree, dotPath) || hasKeyPath(tree, `${dotPath}_other`));
  if (!resolves) {
    issues.push(`${where}: missing text key "${fullKey}" in en locale`);
  }
}

export function keyPaths(tree: LocaleTree): string[] {
  const paths: string[] = [];

  const walk = (node: LocaleTree, prefix: readonly string[]): void => {
    for (const [key, value] of Object.entries(node)) {
      const path = [...prefix, key];
      if (typeof value === 'string') {
        paths.push(path.join('.'));
      } else {
        walk(value, path);
      }
    }
  };

  walk(tree, []);
  return paths.sort();
}

export function compareToReference(locales: Locales, reference = 'en'): string[] {
  const issues: string[] = [];
  const referenceNamespaces = locales[reference];

  if (!referenceNamespaces) {
    issues.push(`missing reference language: ${reference}`);
    return issues;
  }

  const referenceNamespaceNames = Object.keys(referenceNamespaces).sort();

  for (const [lang, namespaces] of Object.entries(locales)) {
    if (lang === reference) continue;

    for (const ns of referenceNamespaceNames) {
      if (!(ns in namespaces)) {
        issues.push(`${lang}: missing namespace ${ns}`);
      }
    }
    for (const ns of Object.keys(namespaces).sort()) {
      if (!(ns in referenceNamespaces)) {
        issues.push(`${lang}/${ns}.yaml: extra namespace ${ns}`);
      }
    }

    for (const ns of referenceNamespaceNames) {
      const refTree = referenceNamespaces[ns];
      const langTree = namespaces[ns];
      if (refTree === undefined || langTree === undefined) continue;

      // Languages have different plural forms, so compare keys without plural suffixes.
      const refKeys = new Set(keyPaths(refTree).map(withoutPluralSuffix));
      const langKeys = new Set(keyPaths(langTree).map(withoutPluralSuffix));

      for (const key of refKeys) {
        if (!langKeys.has(key)) {
          issues.push(`${lang}/${ns}.yaml: missing key ${key}`);
        }
      }
      for (const key of langKeys) {
        if (!refKeys.has(key)) {
          issues.push(`${lang}/${ns}.yaml: extra key ${key}`);
        }
      }
    }
  }

  return issues;
}

/** Key path without an i18next plural suffix (`a.moves_one` → `a.moves`). */
function withoutPluralSuffix(path: string): string {
  return path.replace(PLURAL_SUFFIX_PATTERN, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
