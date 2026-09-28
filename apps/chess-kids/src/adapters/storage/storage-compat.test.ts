// Snapshot rule (docs/refactor-v4.md R0 "storage-compat fixtures"): these snapshots change ONLY
// when the storage or backup format changes on purpose — a v4 refactor PR must leave them
// untouched. A fixture that fails to load cleanly here is a real compat bug: fix the storage code,
// never the fixture (`apps/web/test-fixtures/storage/README.md`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDeps, AppSettings, BackupFile, ParentLock } from '@learn/platform-core';
import { buildBackupFile, parseBackupFile } from '@learn/platform-core/backup';
import { importMerged, planImport } from '@learn/platform-core/merge';
import { CHESS_APP_CONFIG } from '@learn/subject-chess';
import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from '../../app/services.ts';
import { chessWeb } from '../../chess-pack.ts';
import { SCHEMA_VERSION } from './local-store.ts';

const FIXTURES_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures', 'storage');
const TAGS = ['v1.0.0', 'v1.1.0', 'v2.0.0'] as const;

function readFixture(tag: string, name: string): string {
  return readFileSync(join(FIXTURES_DIR, tag, name), 'utf8');
}

function fillLocalStorage(dump: Readonly<Record<string, string>>): void {
  localStorage.clear();
  for (const [key, value] of Object.entries(dump)) {
    localStorage.setItem(key, value);
  }
}

/** One device's own loadable state (what the parent area's own overview/report/backup screens all
 * read): the built backup file (every profile), the parent lock, and device-wide app settings
 * (which embed every profile's own `ProfileSettings`, `AppSettings.profileSettings`). */
interface DeviceSnapshot {
  readonly backup: BackupFile;
  readonly parentLock: ParentLock | undefined;
  readonly appSettings: AppSettings;
}

const MASK = '<masked>';

/** Masks the only two fields this app ever writes that are not a pure function of the stored data:
 * `exportedAt` (the real clock, a new value every run) and `deviceId` (a real random id, once
 * created) — everything else must match the fixture byte for byte. */
function maskSnapshot(snapshot: DeviceSnapshot): DeviceSnapshot {
  return {
    ...snapshot,
    backup: { ...snapshot.backup, exportedAt: MASK },
    appSettings: {
      ...snapshot.appSettings,
      ...(snapshot.appSettings.deviceId === undefined ? {} : { deviceId: MASK }),
    },
  };
}

async function snapshotOf(deps: AppDeps): Promise<DeviceSnapshot> {
  const profiles = await deps.profiles.list();
  const backup = await buildBackupFile(
    deps,
    profiles.map((profile) => profile.id),
  );
  const parentLock = await deps.parentLock.get();
  const appSettings = await deps.settings.get();
  return maskSnapshot({ backup, parentLock, appSettings });
}

/** Pretty-printed (`JSON.stringify(v, null, 1)`) so a diff here stays reviewable, same convention
 * as `packages/content/src/content-snapshot.test.ts`. */
function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 1)}\n`;
}

function snapshotFile(tag: string, name: string): string {
  return join('..', '..', '..', 'test-fixtures', 'storage', tag, name);
}

beforeEach(() => {
  localStorage.clear();
});

describe.each(TAGS)('storage compat: %s', (tag) => {
  it('loads local-storage.json cleanly (no StorageError, current schema version)', async () => {
    fillLocalStorage(JSON.parse(readFixture(tag, 'local-storage.json')) as Record<string, string>);

    const { deps } = createServices(chessWeb, CHESS_APP_CONFIG, localStorage);
    const snapshot = await snapshotOf(deps);

    expect(localStorage.getItem('chess-kids:schema-version')).toBe(String(SCHEMA_VERSION));
    await expect(pretty(snapshot)).toMatchFileSnapshot(snapshotFile(tag, 'loaded.snap.json'));
  });

  it('merges backup-all.json into an empty device', async () => {
    const { deps } = createServices(chessWeb, CHESS_APP_CONFIG, localStorage);
    const incoming = await parseBackupFile(deps, readFixture(tag, 'backup-all.json'));

    const plan = await planImport(deps, incoming);
    await importMerged(
      deps,
      incoming,
      plan.children.map((child) => child.defaultChoice),
    );

    const snapshot = await snapshotOf(deps);
    await expect(pretty(snapshot)).toMatchFileSnapshot(
      snapshotFile(tag, 'merged-into-empty.snap.json'),
    );
  });

  it('merges backup-all.json into the v2.0.0 local-storage device', async () => {
    fillLocalStorage(
      JSON.parse(readFixture('v2.0.0', 'local-storage.json')) as Record<string, string>,
    );

    const { deps } = createServices(chessWeb, CHESS_APP_CONFIG, localStorage);
    const incoming = await parseBackupFile(deps, readFixture(tag, 'backup-all.json'));

    const plan = await planImport(deps, incoming);
    await importMerged(
      deps,
      incoming,
      plan.children.map((child) => child.defaultChoice),
    );

    const snapshot = await snapshotOf(deps);
    await expect(pretty(snapshot)).toMatchFileSnapshot(
      snapshotFile(tag, 'merged-into-v2.0.0.snap.json'),
    );
  });
});
