import type { AppDeps, ContentSource } from '@chess-kids/core';
import { chessJsRules, createVariantRules } from '@chess-kids/core';
import { createCryptoIds } from '../adapters/ids.ts';
import { createSystemClock } from '../adapters/clock.ts';
import { createWebSpeechNarrator } from '../adapters/narration/web-speech-narrator.ts';
import { LocalStorageParentLockRepository } from '../adapters/storage/local-parent-lock-repository.ts';
import { LocalStorageProfileRepository } from '../adapters/storage/local-profile-repository.ts';
import { LocalStorageProgressRepository } from '../adapters/storage/local-progress-repository.ts';
import { LocalStorageSettingsRepository } from '../adapters/storage/local-settings-repository.ts';
import { openLocalStore } from '../adapters/storage/local-store.ts';
import type { Services } from '../app/services.ts';
import { createFakePasswordFileWriter } from './fake-password-file-writer.ts';
import { createMemoryStorage } from './memory-storage.ts';

/**
 * Same wiring as `createServices`, but with an injectable `ContentSource` so tests can use a
 * small fixture lesson instead of the real bundled content. `createWebSpeechNarrator()` already
 * returns the silent no-op narrator under jsdom (no `speechSynthesis`), so this doubles as the
 * "fake narrator" tests need for free.
 */
export function createTestServices(
  content: ContentSource,
  storage: Storage = createMemoryStorage(),
): Services {
  const store = openLocalStore(storage);
  const deps: AppDeps = {
    profiles: new LocalStorageProfileRepository(store),
    progress: new LocalStorageProgressRepository(store),
    clock: createSystemClock(),
    ids: createCryptoIds(),
    content,
    parentLock: new LocalStorageParentLockRepository(store),
    passwordFile: createFakePasswordFileWriter(),
    settings: new LocalStorageSettingsRepository(store),
  };

  return {
    deps,
    rules: createVariantRules(chessJsRules),
    narrator: createWebSpeechNarrator(),
  };
}
