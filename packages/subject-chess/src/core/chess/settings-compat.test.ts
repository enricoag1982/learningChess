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
