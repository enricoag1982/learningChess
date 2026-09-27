import { z } from 'zod';

/** Language directory name pattern: ISO 639-1 code, optionally with an ISO 3166-1 region (e.g. `en`, `en-US`). */
export const LANG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

/** Kebab-case name pattern shared by namespace file names and locale tree keys. */
export const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** i18next plural suffixes allowed on leaf keys (`moves_one`, `moves_other`). */
export const PLURAL_SUFFIX_PATTERN = /_(zero|one|two|few|many|other)$/;

/** Validates a locale leaf key: kebab-case, optionally with an i18next plural suffix. */
export const leafKeySchema = z
  .string()
  .refine((key) => KEY_PATTERN.test(key.replace(PLURAL_SUFFIX_PATTERN, '')));

/** Validates a language directory name. */
export const langSchema = z.string().regex(LANG_PATTERN);

/** Validates a namespace file name (without extension) or a single locale tree key. */
export const keySchema = z.string().regex(KEY_PATTERN);

/** Locale key reference: one or more kebab-case segments joined by dots, e.g. `rook-01` or
 * `rook.story`. Platform-generic (no subject knows about `characters:`/`lessons:` here); a
 * subject's own compile step prefixes the namespace. */
const TEXT_REF_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;
export const textRefSchema = z.string().regex(TEXT_REF_PATTERN);

/** Validates a translated leaf value: a non-empty string (i18next `{{var}}` interpolation allowed). */
export const textLeafSchema = z.string().min(1);

/** Nested map of kebab-case keys to translated text or further nested maps. */
export type LocaleTree = { [key: string]: string | LocaleTree };

/** Zod schema for {@link LocaleTree}. */
export const localeTreeSchema: z.ZodType<LocaleTree> = z.lazy(() =>
  z.record(keySchema, z.union([textLeafSchema, localeTreeSchema])),
);

/** Sorts a locale tree's keys alphabetically, recursively — a canonical order independent of
 * authoring/file-system order, so a future deep-merge of the same namespace from two locale roots
 * (design-r4.md §2 leak #17) is deterministic regardless of which root lists a key first. */
export function sortLocaleTree(tree: LocaleTree): LocaleTree {
  const sorted: Record<string, string | LocaleTree> = {};
  for (const key of Object.keys(tree).sort()) {
    const value = tree[key];
    sorted[key] = typeof value === 'string' ? value : sortLocaleTree(value ?? {});
  }
  return sorted;
}

/** Sorts every namespace of a language record, and the namespaces themselves, canonically. */
export function sortNamespaces(
  namespaces: Readonly<Record<string, LocaleTree>>,
): Record<string, LocaleTree> {
  const sorted: Record<string, LocaleTree> = {};
  for (const name of Object.keys(namespaces).sort()) {
    const tree = namespaces[name];
    if (tree !== undefined) {
      sorted[name] = sortLocaleTree(tree);
    }
  }
  return sorted;
}
