import { z } from 'zod';

/** Language directory name pattern: ISO 639-1 code, optionally with an ISO 3166-1 region (e.g. `en`, `en-US`). */
export const LANG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

export const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const PLURAL_SUFFIX_PATTERN = /_(zero|one|two|few|many|other)$/;

export const leafKeySchema = z
  .string()
  .refine((key) => KEY_PATTERN.test(key.replace(PLURAL_SUFFIX_PATTERN, '')));

export const langSchema = z.string().regex(LANG_PATTERN);

export const keySchema = z.string().regex(KEY_PATTERN);

/** Locale key reference: kebab-case segments joined by dots (`rook-01`, `rook.story`). Platform-generic: a subject's
 * compile step prefixes the namespace. */
const TEXT_REF_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;
export const textRefSchema = z.string().regex(TEXT_REF_PATTERN);

export const exerciseBaseFields = {
  id: keySchema,
  /** Locale key for the instruction text; defaults to `id` when absent. */
  text: textRefSchema.optional(),
  easier: keySchema.optional(),
};

export const textLeafSchema = z.string().min(1);

export type LocaleTree = { [key: string]: string | LocaleTree };

export const localeTreeSchema: z.ZodType<LocaleTree> = z.lazy(() =>
  z.record(keySchema, z.union([textLeafSchema, localeTreeSchema])),
);

/** Sorts keys alphabetically, recursively: a canonical order so a deep-merge is deterministic whichever root lists a key first. */
export function sortLocaleTree(tree: LocaleTree): LocaleTree {
  const sorted: Record<string, string | LocaleTree> = {};
  for (const key of Object.keys(tree).sort()) {
    const value = tree[key];
    sorted[key] = typeof value === 'string' ? value : sortLocaleTree(value ?? {});
  }
  return sorted;
}

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
