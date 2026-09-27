import type {
  AppDeps,
  BackupFileWriter,
  BackupImporter,
  BotPlayer,
  Narrator,
  VariantRules,
} from '@chess-kids/core';
import { chessJsRules, createVariantRules } from '@chess-kids/core';
import { createWorkerBotPlayer } from '../adapters/bot/worker-bot-player.ts';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createCryptoIds } from '../adapters/ids.ts';
import { createSystemClock } from '../adapters/clock.ts';
import { createDownloadPasswordFileWriter } from '../adapters/download-password-file-writer.ts';
import type { AudioNarratorOutcome } from '../adapters/narration/audio-narrator.ts';
import { createAudioNarrator } from '../adapters/narration/audio-narrator.ts';
import { createGatedNarrator } from '../adapters/narration/gated-narrator.ts';
import { createWebSpeechNarrator } from '../adapters/narration/web-speech-narrator.ts';
import { createMathRandom } from '../adapters/random.ts';
import { LocalStorageAssessmentRepository } from '../adapters/storage/local-assessment-repository.ts';
import { LocalStorageGameRecordRepository } from '../adapters/storage/local-game-record-repository.ts';
import { LocalStorageParentLockRepository } from '../adapters/storage/local-parent-lock-repository.ts';
import { LocalStorageProfileRepository } from '../adapters/storage/local-profile-repository.ts';
import { LocalStorageProgressRepository } from '../adapters/storage/local-progress-repository.ts';
import { LocalStorageRewardsRepository } from '../adapters/storage/local-rewards-repository.ts';
import { LocalStorageSettingsRepository } from '../adapters/storage/local-settings-repository.ts';
import type { LocalStore } from '../adapters/storage/local-store.ts';
import { openLocalStore, SCHEMA_VERSION } from '../adapters/storage/local-store.ts';
import { MIGRATIONS } from '../adapters/storage/migrations.ts';

/** `AppDeps.backupFileWriter`/`backupImporter`: read only from the lazy-loaded Parent area
 * (`app/backup.ts`, `app/merge.ts`), so their implementations are fetched on first use instead of
 * shipping in the initial bundle. */
function createLazyBackupFileWriter(): BackupFileWriter {
  return {
    async write(filename, contents) {
      const { createDownloadBackupFileWriter } =
        await import('../adapters/download-backup-file-writer.ts');
      return createDownloadBackupFileWriter().write(filename, contents);
    },
  };
}

/** Same reasoning as `createLazyBackupFileWriter`. */
function createLazyBackupImporter(store: LocalStore): BackupImporter {
  return {
    async replaceAll(file) {
      const { LocalStorageBackupImporter } =
        await import('../adapters/storage/local-backup-importer.ts');
      return new LocalStorageBackupImporter(store).replaceAll(file);
    },
    async writeMerged(file, options) {
      const { LocalStorageBackupImporter } =
        await import('../adapters/storage/local-backup-importer.ts');
      return new LocalStorageBackupImporter(store).writeMerged(file, options);
    },
  };
}

/** The app's wired-up use-case dependencies, plus the pieces the UI reaches for directly. */
export interface Services {
  readonly deps: AppDeps;
  readonly rules: VariantRules;
  readonly narrator: Narrator;
  readonly botPlayer: BotPlayer;
  /** Gates `narrator` on the active profile's "voice" setting (app-structure.md §11 "Settings
   * effect now") — set at every profile select. */
  setVoiceEnabled(enabled: boolean): void;
  /** The active profile's nickname, stripped from narrated text before the generated-audio lookup
   * (`docs/voice.md`) — set at every profile select, alongside `setVoiceEnabled`. */
  setNickname(nickname: string | null): void;
  /** The parent area "Test voice" check (`ChildSettings.tsx`): speaks `text` through the real audio
   * narrator, bypassing the voice on/off setting, and reports whether generated audio played. */
  testVoice(text: string): Promise<AudioNarratorOutcome>;
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
    backupFileWriter: createLazyBackupFileWriter(),
    backupImporter: createLazyBackupImporter(store),
    storageSchemaVersion: SCHEMA_VERSION,
  };

  // Pre-generated Kokoro audio per narrated text (docs/voice.md), Web Speech as the fallback for
  // any text without generated audio — `createGatedNarrator` wraps the combined pair.
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
    testVoice: async (text) => {
      await audioNarrator.speak(text);
      // `doSpeak` (`audio-narrator.ts`) always sets this before returning; the fallback here is
      // only for type safety (`lastOutcome()` is `| null` before any call ever completes).
      return audioNarrator.lastOutcome() ?? { kind: 'fallback', reason: 'no-audio-context' };
    },
  };
}
