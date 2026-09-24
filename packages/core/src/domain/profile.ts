/** Fields on every stored record (sync-ready). Timestamps are ISO 8601 strings. */
export interface StoredRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Profile extends StoredRecord {
  readonly accountId: string;
  readonly nickname: string;
  /** Animal avatar id, e.g. `fox`. */
  readonly avatar: string;
  /** BCP 47 language tag, e.g. `en`. */
  readonly locale: string;
}

/** Letters (any script), digits, spaces, hyphen and apostrophe: enough for most given names. */
const NICKNAME_PATTERN = /^[\p{L}\p{N} '-]+$/u;
const MAX_NICKNAME_LENGTH = 12;

/** `1–12` visible characters after trimming, from `NICKNAME_PATTERN`. */
export function validateNickname(nickname: string): boolean {
  const trimmed = nickname.trim();
  return (
    trimmed.length >= 1 && trimmed.length <= MAX_NICKNAME_LENGTH && NICKNAME_PATTERN.test(trimmed)
  );
}

/** Fresh, unsaved profile for a new player (nickname is trimmed). */
export function newProfile(id: string, nickname: string, avatar: string, now: Date): Profile {
  const nowIso = now.toISOString();
  return {
    id,
    accountId: 'local',
    nickname: nickname.trim(),
    avatar,
    locale: 'en',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
