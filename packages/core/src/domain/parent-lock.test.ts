import { describe, expect, it } from 'vitest';
import { changePassword, checkPassword, isValidPassword, newParentLock } from './parent-lock.ts';

const T0 = new Date('2026-01-01T00:00:00.000Z');

describe('isValidPassword', () => {
  it('rejects fewer than 4 characters after trim', () => {
    expect(isValidPassword('123')).toBe(false);
    expect(isValidPassword('  1  ')).toBe(false);
  });

  it('accepts 4+ characters, including an all-digit PIN', () => {
    expect(isValidPassword('1234')).toBe(true);
    expect(isValidPassword('abcd')).toBe(true);
    expect(isValidPassword('  abcd  ')).toBe(true);
  });
});

describe('newParentLock', () => {
  it('starts with no failed attempts and no lock', () => {
    const lock = newParentLock('lock-1', '1234', 'Downloads/pw.txt', T0);
    expect(lock).toEqual({
      id: 'lock-1',
      password: '1234',
      fileLocation: 'Downloads/pw.txt',
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
  });
});

describe('checkPassword', () => {
  it('right password: ok, counter stays at 0', () => {
    const lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    const result = checkPassword(lock, '1234', T0);
    expect(result.ok).toBe(true);
    expect(result.waitMs).toBe(0);
    expect(result.lock.failedAttempts).toBe(0);
    expect(result.lock.lockedUntil).toBeNull();
  });

  it('wrong password: not ok, counter +1, no lock yet', () => {
    const lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    const result = checkPassword(lock, 'wrong', T0);
    expect(result.ok).toBe(false);
    expect(result.waitMs).toBe(0);
    expect(result.lock.failedAttempts).toBe(1);
    expect(result.lock.lockedUntil).toBeNull();
  });

  it('right password after some wrong attempts resets the counter', () => {
    let lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    lock = checkPassword(lock, 'wrong', T0).lock;
    lock = checkPassword(lock, 'wrong', T0).lock;
    expect(lock.failedAttempts).toBe(2);

    const result = checkPassword(lock, '1234', T0);
    expect(result.ok).toBe(true);
    expect(result.lock.failedAttempts).toBe(0);
  });

  it('the 5th wrong attempt locks for 60s and resets the counter', () => {
    let lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    for (let i = 0; i < 4; i += 1) {
      lock = checkPassword(lock, 'wrong', T0).lock;
    }
    expect(lock.failedAttempts).toBe(4);

    const result = checkPassword(lock, 'wrong', T0);
    expect(result.ok).toBe(false);
    expect(result.waitMs).toBe(60_000);
    expect(result.lock.failedAttempts).toBe(0);
    expect(result.lock.lockedUntil).toBe(new Date(T0.getTime() + 60_000).toISOString());
  });

  it('while locked, rejects without counting the attempt, waitMs = remaining', () => {
    let lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    for (let i = 0; i < 5; i += 1) {
      lock = checkPassword(lock, 'wrong', T0).lock;
    }
    expect(lock.lockedUntil).not.toBeNull();

    const midLock = new Date(T0.getTime() + 20_000);
    const result = checkPassword(lock, '1234', midLock); // even the right password is rejected
    expect(result.ok).toBe(false);
    expect(result.waitMs).toBe(40_000);
    expect(result.lock).toEqual(lock); // unchanged: not counted
  });

  it('unlocks again once 60s have passed', () => {
    let lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    for (let i = 0; i < 5; i += 1) {
      lock = checkPassword(lock, 'wrong', T0).lock;
    }
    const after = new Date(T0.getTime() + 60_001);

    const result = checkPassword(lock, '1234', after);
    expect(result.ok).toBe(true);
    expect(result.lock.lockedUntil).toBeNull();
  });
});

describe('changePassword', () => {
  it('sets a new password/location and clears attempts and any lock', () => {
    let lock = newParentLock('lock-1', '1234', 'file.txt', T0);
    lock = checkPassword(lock, 'wrong', T0).lock;

    const updated = changePassword(lock, '5678', 'file2.txt', T0);
    expect(updated.password).toBe('5678');
    expect(updated.fileLocation).toBe('file2.txt');
    expect(updated.failedAttempts).toBe(0);
    expect(updated.lockedUntil).toBeNull();
  });
});
