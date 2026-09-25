import { sha256Hex } from './sha256.ts';

const CURLY_SINGLE_QUOTES = /[‘’ʼ]/g;
const CURLY_DOUBLE_QUOTES = /[“”]/g;
const DASHES = /[‐‑‒–—―]/g;
const WHITESPACE_RUN = /\s+/g;

/**
 * Normalises narrated text before it becomes (or is looked up as) a generated-audio key
 * (`docs/voice.md`): trims, collapses internal whitespace runs to one space, and folds curly
 * quotes/apostrophes and the various dash characters content or i18n might produce down to one
 * plain form each — so the same sentence authored with a typographic `'` or an em dash still maps
 * to the same key as one written with a plain `'`/`-`.
 */
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

/**
 * Removes `nickname` from `text`, together with one adjacent `", "`, `" ,"` or plain space, so
 * e.g. "Great job, Mia!" reads "Great job!" (the child's name is never in generated audio —
 * `docs/voice.md` "Nickname"; subtitles are unaffected, they still show `text` as authored).
 * Matches on a whole-word boundary, so a nickname that is also a substring of another word (`"Al"`
 * inside `"Also"`) is left alone. `nickname` absent/blank is a no-op (returns `text` unchanged).
 */
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

/**
 * The generated-audio manifest key for `text` (`docs/voice.md`): the first 16 hex characters of
 * `sha256(normalizeVoiceText(text))`. Both the content build's inventory script and the audio
 * narrator adapter call this on the exact same normalised text, so a hit at build time is a hit at
 * runtime.
 */
export function voiceKey(text: string): string {
  return sha256Hex(normalizeVoiceText(text)).slice(0, 16);
}
