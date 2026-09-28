import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { createAppUpdate } from './app-update.ts';
import type { RegisterSW } from './app-update.ts';

/** A `RegisterSW` fake standing in for `virtual:pwa-register`'s real `registerSW`: records the
 * options it was called with (read via `.options` — a plain mutable field, not destructured, so
 * callers see it update once `createAppUpdate` actually calls `register`) and returns `updateSW`. */
class FakeRegister {
  options: RegisterSWOptions | undefined;
  readonly updateSW = vi.fn().mockResolvedValue(undefined);
  readonly register: RegisterSW = (options) => {
    this.options = options;
    return this.updateSW;
  };
}

/** A local `update` reference (not `registration.update` property access) so assertions don't
 * trip `@typescript-eslint/unbound-method` — same reasoning `download-password-file-writer.test.ts`
 * already documents for its own stubbed `URL` methods. */
function fakeRegistration(): {
  readonly registration: ServiceWorkerRegistration;
  readonly update: ReturnType<typeof vi.fn>;
} {
  const update = vi.fn().mockResolvedValue(undefined);
  return { registration: { update } as unknown as ServiceWorkerRegistration, update };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createAppUpdate', () => {
  it('isUpdateReady is false until onNeedRefresh fires', () => {
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    expect(appUpdate.isUpdateReady()).toBe(false);
    fake.options?.onNeedRefresh?.();
    expect(appUpdate.isUpdateReady()).toBe(true);
  });

  it('onUpdateReady listeners run when onNeedRefresh fires; unsubscribe stops them', () => {
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);
    const first = vi.fn();
    const second = vi.fn();
    appUpdate.onUpdateReady(first);
    const unsubscribe = appUpdate.onUpdateReady(second);
    unsubscribe();

    fake.options?.onNeedRefresh?.();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('apply() calls updateSW(true) once ready', async () => {
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    fake.options?.onNeedRefresh?.();
    await appUpdate.apply();

    expect(fake.updateSW).toHaveBeenCalledTimes(1);
    expect(fake.updateSW).toHaveBeenCalledWith(true);
  });

  it('apply() is a no-op before onNeedRefresh has fired', async () => {
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    await appUpdate.apply();

    expect(fake.updateSW).not.toHaveBeenCalled();
  });

  it('apply() is idempotent: a second call never calls updateSW again', async () => {
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    fake.options?.onNeedRefresh?.();
    await appUpdate.apply();
    await appUpdate.apply();

    expect(fake.updateSW).toHaveBeenCalledTimes(1);
  });

  it('onRegisteredSW never polls on a timer (owner decision: no periodic check)', () => {
    vi.useFakeTimers();
    const fake = new FakeRegister();
    createAppUpdate(fake.register);
    const { registration, update } = fakeRegistration();
    fake.options?.onRegisteredSW?.('/sw.js', registration);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000); // a full day
    expect(update).not.toHaveBeenCalled();
  });

  it('onRegisteredSW re-checks when the tab becomes visible again', () => {
    const fake = new FakeRegister();
    createAppUpdate(fake.register);
    const { registration, update } = fakeRegistration();
    fake.options?.onRegisteredSW?.('/sw.js', registration);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('onRegisteredSW is a no-op without a registration', () => {
    const fake = new FakeRegister();
    expect(() => {
      createAppUpdate(fake.register);
      fake.options?.onRegisteredSW?.('/sw.js', undefined);
    }).not.toThrow();
  });
});
