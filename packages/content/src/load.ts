import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  keySchema,
  langSchema,
  leafKeySchema,
  PLURAL_SUFFIX_PATTERN,
  textLeafSchema,
  type LocaleTree,
} from './schema.ts';

/** All namespaces of all languages, keyed by language then namespace name. */
export type Locales = Record<string, Record<string, LocaleTree>>;

/** Thrown by {@link loadLocales} when one or more content issues are found. */
export class ContentError extends Error {
  /** Every issue found, each already prefixed with its file path and key path. */
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(['invalid content:', ...issues].join('\n'));
    this.name = 'ContentError';
    this.issues = issues;
  }
}

/** Reads, parses and validates every locale file under `localesDir`, throwing {@link ContentError} on any issue. */
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

/** Loads every namespace file of one language directory. */
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

  return namespaces;
}

/** Reads and parses one namespace YAML file, then validates it as a {@link LocaleTree}. */
function loadNamespace(
  filePath: string,
  relPath: string,
  issues: string[],
): LocaleTree | undefined {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    issues.push(`${relPath}: cannot read file: ${errorMessage(error)}`);
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw, { uniqueKeys: true });
  } catch (error) {
    issues.push(`${relPath}: YAML syntax error: ${errorMessage(error)}`);
    return undefined;
  }

  if (!isPlainObject(parsed)) {
    issues.push(`${relPath}: root: must be a map of keys to text or nested maps`);
    return undefined;
  }

  return validateNode(parsed, [], relPath, issues);
}

/** Recursively validates one map node of a locale tree, collecting issues per key path. */
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

/** Looks up a dot-separated key path in a locale tree (e.g. `tracks.basics`). */
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

/**
 * Checks that `fullKey` (e.g. `journey:tracks.basics`) resolves to a leaf in the `en` locale — a
 * pluralized leaf (`<key>_other`, always present per CLDR) satisfies a plain (non-suffixed) key too.
 */
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

/** Flattened, sorted dot paths of every leaf in a locale tree. */
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

/** Issues where a language's namespaces or keys diverge from the reference language's. */
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

/** Reads a directory's entry names, reporting an issue (and returning `[]`) if it cannot be read. */
function readEntries(dir: string, issues: string[], description: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch (error) {
    issues.push(`${dir}: cannot read ${description}: ${errorMessage(error)}`);
    return [];
  }
}

/** First line of an error's message, for compact single-line issue reporting. */
function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
