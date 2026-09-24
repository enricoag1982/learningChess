import type { StoredRecord } from './profile.ts';

/**
 * Kid-gate, not a security boundary (non-functional.md §3): the password is kept in plain text.
 * `fileLocation` is where the parent can find it again (adapter-specific: a downloaded file's
 * path on web, a Documents file's path in store apps).
 */
export interface ParentLock extends StoredRecord {
  readonly password: string;
  readonly fileLocation: string;
  readonly failedAttempts: number;
  /** ISO 8601 timestamp until which the gate rejects every attempt; `null` when not locked. */
  readonly lockedUntil: string | null;
}

const MIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60_000;

/** `≥ 4` characters after trimming; any characters allowed, so an all-digit PIN is valid. */
export function isValidPassword(password: string): boolean {
  return password.trim().length >= MIN_LENGTH;
}

/** Fresh lock, no failed attempts, not locked. */
export function newParentLock(
  id: string,
  password: string,
  fileLocation: string,
  now: Date,
): ParentLock {
  const nowIso = now.toISOString();
  return {
    id,
    password,
    fileLocation,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Sets a new password (parent area "Change password"), resetting attempts and any lock. */
export function changePassword(
  lock: ParentLock,
  password: string,
  fileLocation: string,
  now: Date,
): ParentLock {
  return {
    ...lock,
    password,
    fileLocation,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: now.toISOString(),
  };
}

export interface CheckPasswordResult {
  readonly ok: boolean;
  /** Lock state to persist: unchanged while a prior lock still holds, updated otherwise. */
  readonly lock: ParentLock;
  /** Milliseconds still to wait; `0` unless a lock is in effect (existing or just triggered). */
  readonly waitMs: number;
}

/**
 * Checks `input` against `lock.password` (non-functional.md §3: 5 wrong attempts → 1-minute wait).
 * - Still locked: rejected without counting against the attempt total; `waitMs` = time left.
 * - Right password: attempt counter and any lock are cleared.
 * - Wrong password: attempt counter += 1; the 5th wrong attempt locks for 60 s and resets the
 *   counter (so the next check starts counting from 0 again once the lock expires).
 */
export function checkPassword(lock: ParentLock, input: string, now: Date): CheckPasswordResult {
  const nowMs = now.getTime();

  if (lock.lockedUntil !== null) {
    const remaining = new Date(lock.lockedUntil).getTime() - nowMs;
    if (remaining > 0) {
      return { ok: false, lock, waitMs: remaining };
    }
  }

  if (input === lock.password) {
    const unlocked: ParentLock = {
      ...lock,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now.toISOString(),
    };
    return { ok: true, lock: unlocked, waitMs: 0 };
  }

  const failedAttempts = lock.failedAttempts + 1;
  if (failedAttempts >= MAX_ATTEMPTS) {
    const locked: ParentLock = {
      ...lock,
      failedAttempts: 0,
      lockedUntil: new Date(nowMs + LOCK_DURATION_MS).toISOString(),
      updatedAt: now.toISOString(),
    };
    return { ok: false, lock: locked, waitMs: LOCK_DURATION_MS };
  }

  const updated: ParentLock = {
    ...lock,
    failedAttempts,
    lockedUntil: null,
    updatedAt: now.toISOString(),
  };
  return { ok: false, lock: updated, waitMs: 0 };
}
