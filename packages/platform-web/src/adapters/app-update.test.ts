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
  vi.unstubAllGlobals();
});

/** Stands in for the browser APIs `forceRefresh` touches; `workers` / `cacheKeys` left out means that API is missing (old Safari, jsdom). */
function stubBrowser(options: {
  readonly online: boolean;
  readonly workers?: readonly ReturnType<typeof vi.fn>[];
  readonly cacheKeys?: readonly string[];
}): { readonly reload: ReturnType<typeof vi.fn>; readonly deleteCache: ReturnType<typeof vi.fn> } {
  const reload = vi.fn();
  const deleteCache = vi.fn().mockResolvedValue(true);
  const { workers, cacheKeys } = options;
  vi.stubGlobal('location', { reload });
  vi.stubGlobal('navigator', {
    onLine: options.online,
    ...(workers && {
      serviceWorker: {
        getRegistrations: () => Promise.resolve(workers.map((unregister) => ({ unregister }))),
      },
    }),
  });
  if (cacheKeys) {
    vi.stubGlobal('caches', { keys: () => Promise.resolve(cacheKeys), delete: deleteCache });
  }
  return { reload, deleteCache };
}

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

describe('forceRefresh', () => {
  it('offline: reports it and changes nothing (no unregister, no cache delete, no reload)', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const { reload, deleteCache } = stubBrowser({
      online: false,
      workers: [unregister],
      cacheKeys: ['precache'],
    });
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    await expect(appUpdate.forceRefresh()).resolves.toBe('offline');

    expect(unregister).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(fake.updateSW).not.toHaveBeenCalled();
  });

  it('update waiting: takes the apply path (skip-waiting + reload), leaves workers and caches alone', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const { reload, deleteCache } = stubBrowser({
      online: true,
      workers: [unregister],
      cacheKeys: ['precache'],
    });
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);
    fake.options?.onNeedRefresh?.();

    await expect(appUpdate.forceRefresh()).resolves.toBe('reloading');

    expect(fake.updateSW).toHaveBeenCalledTimes(1);
    expect(fake.updateSW).toHaveBeenCalledWith(true);
    expect(unregister).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('no update waiting: unregisters every worker, deletes every cache, then reloads', async () => {
    const first = vi.fn().mockResolvedValue(true);
    const second = vi.fn().mockResolvedValue(true);
    const { reload, deleteCache } = stubBrowser({
      online: true,
      workers: [first, second],
      cacheKeys: ['precache', 'runtime'],
    });
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    await expect(appUpdate.forceRefresh()).resolves.toBe('reloading');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith('precache');
    expect(deleteCache).toHaveBeenCalledWith('runtime');
    expect(fake.updateSW).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('missing serviceWorker and caches APIs: still reloads', async () => {
    const { reload } = stubBrowser({ online: true });
    const fake = new FakeRegister();
    const appUpdate = createAppUpdate(fake.register);

    await expect(appUpdate.forceRefresh()).resolves.toBe('reloading');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never touches localStorage', async () => {
    const clear = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { clear, removeItem });
    const { reload } = stubBrowser({ online: true, workers: [], cacheKeys: [] });
    const fake = new FakeRegister();

    await createAppUpdate(fake.register).forceRefresh();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
