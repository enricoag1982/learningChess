import type { AppDeps, ContentSource } from '@chess-kids/core';
import { bot, chessJsRules, createVariantRules } from '@chess-kids/core';
import { createWorkerBotPlayer } from '../adapters/bot/worker-bot-player.ts';
import { createCryptoIds } from '../adapters/ids.ts';
import { createSystemClock } from '../adapters/clock.ts';
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
import type { Services } from '../app/services.ts';
import { createFakeBackupFileWriter } from './fake-backup-file-writer.ts';
import { createFakeNarrator } from './fake-narrator.ts';
import { createFakePasswordFileWriter } from './fake-password-file-writer.ts';
import { createMemoryStorage } from './memory-storage.ts';

/**
 * Same wiring as `createServices`, but with an injectable `ContentSource` so tests can use a
 * small fixture lesson instead of the real bundled content, and a `FakeNarrator` (`narrator`, cast
 * back to `FakeNarrator` where a test needs its `spoken`/`cancelCount`) gated the same way the real
 * `createServices` gates `createWebSpeechNarrator()`, so a "voice off" setting's effect is testable
 * without touching Web Speech.
 */
export function createTestServices(
  content: ContentSource,
  storage: Storage = createMemoryStorage(),
): Services {
  const store = openLocalStore(storage, { migrations: MIGRATIONS });
  const deps: AppDeps = {
    profiles: new LocalStorageProfileRepository(store),
    progress: new LocalStorageProgressRepository(store),
    gameRecords: new LocalStorageGameRecordRepository(store),
    rewards: new LocalStorageRewardsRepository(store),
    assessment: new LocalStorageAssessmentRepository(store),
    clock: createSystemClock(),
    ids: createCryptoIds(),
    content,
    parentLock: new LocalStorageParentLockRepository(store),
    passwordFile: createFakePasswordFileWriter(),
    settings: new LocalStorageSettingsRepository(store),
    // Deterministic (M3.4 warm-up/practice task picking): RTL tests can assert exact tasks shown.
    random: bot.seededRandom(1),
    backupFileWriter: createFakeBackupFileWriter(),
    backupImporter: new LocalStorageBackupImporter(store),
    storageSchemaVersion: SCHEMA_VERSION,
  };

  const narrator = createFakeNarrator();

  return {
    deps,
    rules: createVariantRules(chessJsRules),
    narrator,
    botPlayer: createWorkerBotPlayer(),
    setVoiceEnabled: (enabled) => {
      narrator.setEnabled(enabled);
    },
  };
}
