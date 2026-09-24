import type { AppDeps, BotPlayer, Narrator, VariantRules } from '@chess-kids/core';
import { chessJsRules, createVariantRules } from '@chess-kids/core';
import { createWorkerBotPlayer } from '../adapters/bot/worker-bot-player.ts';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createCryptoIds } from '../adapters/ids.ts';
import { createSystemClock } from '../adapters/clock.ts';
import { createDownloadPasswordFileWriter } from '../adapters/download-password-file-writer.ts';
import { createWebSpeechNarrator } from '../adapters/narration/web-speech-narrator.ts';
import { LocalStorageParentLockRepository } from '../adapters/storage/local-parent-lock-repository.ts';
import { LocalStorageProfileRepository } from '../adapters/storage/local-profile-repository.ts';
import { LocalStorageProgressRepository } from '../adapters/storage/local-progress-repository.ts';
import { LocalStorageSettingsRepository } from '../adapters/storage/local-settings-repository.ts';
import { openLocalStore } from '../adapters/storage/local-store.ts';

/** The app's wired-up use-case dependencies, plus the pieces the UI reaches for directly. */
export interface Services {
  readonly deps: AppDeps;
  readonly rules: VariantRules;
  readonly narrator: Narrator;
  readonly botPlayer: BotPlayer;
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
    parentLock: new LocalStorageParentLockRepository(store),
    passwordFile: createDownloadPasswordFileWriter(),
    settings: new LocalStorageSettingsRepository(store),
  };

  return {
    deps,
    rules: createVariantRules(chessJsRules),
    narrator: createWebSpeechNarrator(),
    botPlayer: createWorkerBotPlayer(),
  };
}
