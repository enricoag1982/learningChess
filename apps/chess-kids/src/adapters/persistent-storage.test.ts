import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestServices } from '../testing/test-services.ts';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { createMemoryStorage } from '../testing/memory-storage.ts';
import { requestPersistentStorageIfNeeded } from './persistent-storage.ts';

function services(storage: Storage): ReturnType<typeof createTestServices> {
  return createTestServices(fixtureContentSource(fixtureLesson()), storage);
}

/** Reads the raw stored settings record, bypassing `LocalStorageSettingsRepository.get()`'s own
 * `normalize` (M5.1's file, out of this milestone's scope — see `ports.ts`'s own note on
 * `AppSettings.storagePersisted`): as of M5.4 that whitelist does not yet carry this field through
 * a read, so asserting through `deps.settings.get()` here would fail for a reason outside this
 * module's own responsibility. This reads exactly what `save()` actually persisted instead — what
 * `requestPersistentStorageIfNeeded` itself is responsible for. */
function rawStoredSettings(storage: Storage): unknown {
  const raw = storage.getItem('chess-kids:settings');
  return raw === null ? undefined : (JSON.parse(raw) as unknown);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('requestPersistentStorageIfNeeded', () => {
  it('calls navigator.storage.persist() and stores a granted result in settings', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { storage: { persist } }));
    const storage = createMemoryStorage();

    const { deps } = services(storage);
    await requestPersistentStorageIfNeeded(deps);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(rawStoredSettings(storage)).toMatchObject({ storagePersisted: true });
  });

  it('stores a denied result too, so it is never asked again', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { storage: { persist } }));
    const storage = createMemoryStorage();

    const { deps } = services(storage);
    await requestPersistentStorageIfNeeded(deps);

    expect(rawStoredSettings(storage)).toMatchObject({ storagePersisted: false });
  });

  it('only ever asks once: a second call is a no-op once settings already has a result', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { storage: { persist } }));
    const storage = createMemoryStorage();

    const { deps } = services(storage);
    await requestPersistentStorageIfNeeded(deps);
    await requestPersistentStorageIfNeeded(deps);

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the Storage API is unavailable (older browsers, jsdom)', async () => {
    vi.stubGlobal('navigator', Object.assign({}, navigator, { storage: undefined }));
    const storage = createMemoryStorage();

    const { deps } = services(storage);
    await requestPersistentStorageIfNeeded(deps);

    expect(rawStoredSettings(storage)).toBeUndefined();
  });

  it('never throws when persist() itself rejects', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', Object.assign({}, navigator, { storage: { persist } }));

    const { deps } = services(createMemoryStorage());
    await expect(requestPersistentStorageIfNeeded(deps)).resolves.toBeUndefined();
  });
});
