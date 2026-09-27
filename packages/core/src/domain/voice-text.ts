import { sha256Hex } from './sha256.ts';

const CURLY_SINGLE_QUOTES = /[‘’ʼ]/g;
const CURLY_DOUBLE_QUOTES = /[“”]/g;
const DASHES = /[‐‑‒–—―]/g;
const WHITESPACE_RUN = /\s+/g;

/** Normalises narrated text before it becomes a generated-audio key: trims, collapses whitespace,
 * folds curly quotes/dashes to one plain form each, so a typographic `'`/em dash still maps to the
 * same key as a plain `'`/`-`. */
export function normalizeVoiceText(text: string): string {
  return text
    .replace(CURLY_SINGLE_QUOTES, "'")
    .replace(CURLY_DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .trim()
    .replace(WHITESPACE_RUN, ' ');
}

/** Escapes every regex metacharacter in `text`, so it can be dropped into a `RegExp` literally. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Removes `nickname` from `text`, with one adjacent `", "`/`" ,"`/space, so "Great job, Mia!" reads
 * "Great job!" (the child's name is never in generated audio). Whole-word boundary only. */
export function stripNickname(text: string, nickname: string | null | undefined): string {
  const name = nickname?.trim();
  if (!name) return text;
  const escaped = escapeRegExp(name);
  const pattern = new RegExp(
    `(,\\s*\\b${escaped}\\b)` + // ", Mia" (comma before)
      `|(\\b${escaped}\\b\\s*,)` + // "Mia, " (comma after)
      `|(\\s\\b${escaped}\\b)` + // " Mia" mid/end sentence (leading space)
      `|(\\b${escaped}\\b\\s)` + // "Mia " start of sentence (trailing space)
      `|(\\b${escaped}\\b)`, // bare, no adjacent space/comma at all
    'g',
  );
  return text.replace(pattern, '').replace(WHITESPACE_RUN, ' ').trim();
}

/** The generated-audio manifest key for `text`: the first 16 hex characters of
 * `sha256(normalizeVoiceText(text))`. */
export function voiceKey(text: string): string {
  return sha256Hex(normalizeVoiceText(text)).slice(0, 16);
}
