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

/** Validates a translated leaf value: a non-empty string (i18next `{{var}}` interpolation allowed). */
export const textLeafSchema = z.string().min(1);

/** Nested map of kebab-case keys to translated text or further nested maps. */
export type LocaleTree = { [key: string]: string | LocaleTree };

/** Zod schema for {@link LocaleTree}. */
export const localeTreeSchema: z.ZodType<LocaleTree> = z.lazy(() =>
  z.record(keySchema, z.union([textLeafSchema, localeTreeSchema])),
);
