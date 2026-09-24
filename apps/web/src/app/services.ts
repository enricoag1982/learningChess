import type { AppDeps, Narrator, VariantRules } from '@chess-kids/core';
import { chessJsRules, createVariantRules } from '@chess-kids/core';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createCryptoIds } from '../adapters/ids.ts';
import { createSystemClock } from '../adapters/clock.ts';
import { createWebSpeechNarrator } from '../adapters/narration/web-speech-narrator.ts';
import { LocalStorageProfileRepository } from '../adapters/storage/local-profile-repository.ts';
import { LocalStorageProgressRepository } from '../adapters/storage/local-progress-repository.ts';
import { openLocalStore } from '../adapters/storage/local-store.ts';

/** The app's wired-up use-case dependencies, plus the pieces the UI reaches for directly. */
export interface Services {
  readonly deps: AppDeps;
  readonly rules: VariantRules;
  readonly narrator: Narrator;
}

/** Composition root: wires `AppDeps` and friends to their web (localStorage / Web Speech) adapters. */
export function createServices(storage: Storage = window.localStorage): Services {
  const store = openLocalStore(storage);
  const deps: AppDeps = {
    profiles: new LocalStorageProfileRepository(store),
    progress: new LocalStorageProgressRepository(store),
    clock: createSystemClock(),
    ids: createCryptoIds(),
    content: createBundledContentSource(),
  };

  return {
    deps,
    rules: createVariantRules(chessJsRules),
    narrator: createWebSpeechNarrator(),
  };
}
