import type { AppDeps, BotPlayer, Narrator, VariantRules } from '@chess-kids/core';
import { chessJsRules, createVariantRules } from '@chess-kids/core';
import { createWorkerBotPlayer } from '../adapters/bot/worker-bot-player.ts';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createCryptoIds } from '../adapters/ids.ts';
import { createSystemClock } from '../adapters/clock.ts';
import { createDownloadBackupFileWriter } from '../adapters/download-backup-file-writer.ts';
import { createDownloadPasswordFileWriter } from '../adapters/download-password-file-writer.ts';
import { createAudioNarrator } from '../adapters/narration/audio-narrator.ts';
import { createGatedNarrator } from '../adapters/narration/gated-narrator.ts';
import { createWebSpeechNarrator } from '../adapters/narration/web-speech-narrator.ts';
import { createMathRandom } from '../adapters/random.ts';
import { LocalStorageAssessmentRepository } from '../adapters/storage/local-assessment-repository.ts';
import { LocalStorageBackupImporter } from '../adapters/storage/local-backup-importer.ts';
import { LocalStorageGameRecordRepository } from '../adapters/storage/local-game-record-repository.ts';
import { LocalStorageParentLockRepository } from '../adapters/storage/local-parent-lock-repository.ts';
import { LocalStorageProfileRepository } from '../adapters/storage/local-profile-repository.ts';
import { LocalStorageProgressRepository } from '../adapters/storage/local-progress-repository.ts';
import { LocalStorageRewardsRepository } from '../adapters/storage/local-rewards-repository.ts';
import { LocalStorageSettingsRepository } from '../adapters/storage/local-settings-repository.ts';
import { openLocalStore, SCHEMA_VERSION } from '../adapters/storage/local-store.ts';
import { MIGRATIONS } from '../adapters/storage/migrations.ts';

/** The app's wired-up use-case dependencies, plus the pieces the UI reaches for directly. */
export interface Services {
  readonly deps: AppDeps;
  readonly rules: VariantRules;
  readonly narrator: Narrator;
  readonly botPlayer: BotPlayer;
  /** Gates `narrator` on the active profile's "voice" setting (M5.1, app-structure.md §11
   * "Settings effect now") — set at every profile select (`selectProfileAndHome`, `store.ts`). */
  setVoiceEnabled(enabled: boolean): void;
  /** The active profile's nickname, stripped from narrated text before the generated-audio lookup
   * (M6.2, `docs/voice.md`) — set at every profile select, alongside `setVoiceEnabled`. */
  setNickname(nickname: string | null): void;
}

/** Composition root: wires `AppDeps` and friends to their web (localStorage / Web Speech) adapters. */
export function createServices(storage: Storage = window.localStorage): Services {
  const store = openLocalStore(storage, { migrations: MIGRATIONS });
  const deps: AppDeps = {
    profiles: new LocalStorageProfileRepository(store),
    progress: new LocalStorageProgressRepository(store),
    gameRecords: new LocalStorageGameRecordRepository(store),
    rewards: new LocalStorageRewardsRepository(store),
    assessment: new LocalStorageAssessmentRepository(store),
    clock: createSystemClock(),
    ids: createCryptoIds(),
    content: createBundledContentSource(),
    parentLock: new LocalStorageParentLockRepository(store),
    passwordFile: createDownloadPasswordFileWriter(),
    settings: new LocalStorageSettingsRepository(store),
    random: createMathRandom(),
    backupFileWriter: createDownloadBackupFileWriter(),
    backupImporter: new LocalStorageBackupImporter(store),
    storageSchemaVersion: SCHEMA_VERSION,
  };

  // M6.2 (docs/voice.md): pre-generated Kokoro audio per narrated text, Web Speech (device voice)
  // as the fallback for any text without generated audio — `createGatedNarrator` wraps the
  // combined pair, same as it wrapped Web Speech alone before this milestone.
  const audioNarrator = createAudioNarrator({
    baseUrl: `${import.meta.env.BASE_URL}audio/en/`,
    fallback: createWebSpeechNarrator(),
  });
  const narrator = createGatedNarrator(audioNarrator);

  return {
    deps,
    rules: createVariantRules(chessJsRules),
    narrator,
    botPlayer: createWorkerBotPlayer(),
    setVoiceEnabled: (enabled) => {
      narrator.setEnabled(enabled);
    },
    setNickname: (nickname) => {
      audioNarrator.setNickname(nickname);
    },
  };
}
