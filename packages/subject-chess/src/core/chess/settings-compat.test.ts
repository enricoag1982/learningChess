// Old data keeps loading: v1.0.0-v2.0.0 stored `pieceStyle` (the retired "Piece style" setting).
import { describe, expect, it } from 'vitest';

import { createProfile, getProfileSettings, updateProfileSettings } from '@learn/platform-core';
import { buildBackupFile, parseBackupFile } from '@learn/platform-core/backup';
import { makeSettingsRepo } from '@learn/platform-core/testing';
import { makeDeps } from '../../testing/index.ts';

/** A v2.0.0 profile's stored settings (a variable, not a literal: `pieceStyle` is no longer a `ProfileSettings` field). */
const V2_SETTINGS = {
  dailyLimitMinutes: 30,
  voice: true,
  sound: true,
  hints: true,
  computerLevel: 2,
  pieceStyle: 'classic',
  updatedAt: '2026-09-26T21:45:09.942Z',
} as const;

describe('a stored v2.0.0 settings object with pieceStyle', () => {
  it('loads with the field ignored, and the next save drops it', async () => {
    const deps = makeDeps({
      settings: makeSettingsRepo({
        lastProfileId: null,
        suggestedLevels: {},
        profileSettings: { p1: V2_SETTINGS },
      }),
    });

    const loaded = await getProfileSettings(deps, 'p1');
    expect(loaded.computerLevel).toBe(2);
    expect(loaded.dailyLimitMinutes).toBe(30);
    expect(Object.keys(loaded)).not.toContain('pieceStyle');

    await updateProfileSettings(deps, 'p1', { hints: false });
    const saved = (await deps.settings.get()).profileSettings.p1;
    expect(saved).toMatchObject({ computerLevel: 2, dailyLimitMinutes: 30, hints: false });
    expect(Object.keys(saved ?? {})).not.toContain('pieceStyle');
  });

  it('is never rejected when it arrives in a backup file, and the field is not kept', async () => {
    const source = makeDeps();
    const profile = await createProfile(source, 'Mia', 'fox');
    const file = await buildBackupFile(source, [profile.id]);
    const withPieceStyle = {
      ...file,
      data: {
        [profile.id]: { ...file.data[profile.id], settings: { ...V2_SETTINGS } },
      },
    };

    const parsed = await parseBackupFile(makeDeps(), JSON.stringify(withPieceStyle));

    const settings = parsed.data[profile.id]?.settings;
    expect(settings).toMatchObject({ computerLevel: 2, dailyLimitMinutes: 30 });
    expect(Object.keys(settings ?? {})).not.toContain('pieceStyle');
  });
});

describe('backup export for a v2.0.0 install', () => {
  it('writes a constant pieceStyle "classic" in every child, overriding any stored value', async () => {
    const deps = makeDeps();
    const mia = await createProfile(deps, 'Mia', 'fox');
    const leo = await createProfile(deps, 'Leo', 'panda');
    const animalStyle = { ...V2_SETTINGS, pieceStyle: 'animal' };
    await deps.settings.save({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: { [mia.id]: animalStyle },
    });

    const file = await buildBackupFile(deps);

    expect(file.data[mia.id]?.settings).toMatchObject({ pieceStyle: 'classic', computerLevel: 2 });
    expect(file.data[leo.id]?.settings).toMatchObject({ pieceStyle: 'classic' });
  });

  it('is read back without the field (write-only)', async () => {
    const deps = makeDeps();
    const mia = await createProfile(deps, 'Mia', 'fox');
    const file = await buildBackupFile(deps, [mia.id]);

    const parsed = await parseBackupFile(deps, JSON.stringify(file));

    expect(Object.keys(parsed.data[mia.id]?.settings ?? {})).not.toContain('pieceStyle');
  });
});
