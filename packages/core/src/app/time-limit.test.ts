import { describe, expect, it } from 'vitest';

import { composeDefaultSettings } from '../domain/profile-settings.ts';
import type { SessionLog } from '../domain/session-log.ts';
import {
  makeDeps as buildDeps,
  makeRewardsRepo as buildRewardsRepo,
  makeClock,
} from '../testing/index.ts';
import {
  checkActivityGate,
  grantExtraTime,
  grantHoursOverride,
  markTimeWarning,
} from './time-limit.ts';
import type { AppDeps } from './use-cases.ts';
import type { AppSettings, RewardsRepository, SettingsRepository } from './ports.ts';

const NOW = new Date(2026, 0, 5, 10, 0, 0); // 2026-01-05, local

function makeRewardsRepo(initial: readonly SessionLog[] = []): RewardsRepository {
  return buildRewardsRepo({ sessionLogs: initial });
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    rewards: makeRewardsRepo(),
    clock: makeClock(NOW),
    ...overrides,
  });
}

const DEFAULT_PROFILE_SETTINGS = composeDefaultSettings(buildDeps({}).subject.settings);

function withSettings(profileSettings: AppSettings['profileSettings']): SettingsRepository {
  const stored: AppSettings = { lastProfileId: null, suggestedLevels: {}, profileSettings };
  return { get: () => Promise.resolve(stored), save: () => Promise.resolve() };
}

describe('checkActivityGate', () => {
  it('reads under limit with the limit off, even with a lot of minutes logged', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: null } }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-05',
          minutes: 999,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    const status = await checkActivityGate(deps, 'p1');
    expect(status).toEqual({
      overLimit: false,
      limitMinutes: null,
      usedMinutes: 999,
      extraMinutes: 0,
      reason: null,
      remainingMinutes: null,
      playFrom: null,
    });
  });

  it('flags over limit once played minutes reach the daily limit', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 } }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-05',
          minutes: 30,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    expect((await checkActivityGate(deps, 'p1')).overLimit).toBe(true);
  });

  it("is never over the limit off a previous day's log (midnight reset)", async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 } }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-04',
          minutes: 999,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    const status = await checkActivityGate(deps, 'p1');
    expect(status.overLimit).toBe(false);
    expect(status.usedMinutes).toBe(0);
  });

  it('reads under limit (0 used) without deps.rewards wired up', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 15 } }),
      rewards: undefined,
    });
    expect(await checkActivityGate(deps, 'p1')).toEqual({
      overLimit: false,
      limitMinutes: 15,
      usedMinutes: 0,
      extraMinutes: 0,
      reason: null,
      remainingMinutes: 15,
      playFrom: null,
    });
  });
});

describe('grantExtraTime', () => {
  it("adds today's grant to a fresh session-log row", async () => {
    const deps = makeDeps();
    const log = await grantExtraTime(deps, 'p1');
    expect(log.extraMinutes).toBe(15);
    expect(log.minutes).toBe(0);
  });

  it('is repeatable: a second grant the same day adds another 15', async () => {
    const deps = makeDeps();
    await grantExtraTime(deps, 'p1');
    const second = await grantExtraTime(deps, 'p1');
    expect(second.extraMinutes).toBe(30);
  });

  it('lifts a gated profile back under the limit', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 } }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-05',
          minutes: 30,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    expect((await checkActivityGate(deps, 'p1')).overLimit).toBe(true);
    await grantExtraTime(deps, 'p1');
    expect((await checkActivityGate(deps, 'p1')).overLimit).toBe(false);
  });

  it('throws without deps.rewards wired up', async () => {
    const deps = makeDeps({ rewards: undefined });
    await expect(grantExtraTime(deps, 'p1')).rejects.toThrow();
  });
});

describe('checkActivityGate — reason (M7.1)', () => {
  it('reason "limit" once over the daily limit, hours unrestricted', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 } }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-05',
          minutes: 30,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    const status = await checkActivityGate(deps, 'p1');
    expect(status.overLimit).toBe(true);
    expect(status.reason).toBe('limit');
  });

  it('reason "late" once past playUntil, even under the daily limit', async () => {
    const deps = makeDeps({
      settings: withSettings({
        p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 999, playUntil: '09:00' },
      }),
    });
    const status = await checkActivityGate(deps, 'p1'); // NOW = 10:00 local
    expect(status.overLimit).toBe(true);
    expect(status.reason).toBe('late');
  });

  it('reason "early" before playFrom', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, playFrom: '11:00' } }),
    });
    const status = await checkActivityGate(deps, 'p1'); // NOW = 10:00 local
    expect(status.overLimit).toBe(true);
    expect(status.reason).toBe('early');
    expect(status.playFrom).toBe('11:00'); // TimeLimitScreen's "Chess opens at {{time}}" source
  });

  it('playFrom is null when off/absent', async () => {
    const deps = makeDeps({ settings: withSettings({ p1: DEFAULT_PROFILE_SETTINGS }) });
    const status = await checkActivityGate(deps, 'p1');
    expect(status.playFrom).toBeNull();
  });

  it('hours take priority over the daily limit when both are violated', async () => {
    const deps = makeDeps({
      settings: withSettings({
        p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30, playUntil: '09:00' },
      }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-05',
          minutes: 30,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    expect((await checkActivityGate(deps, 'p1')).reason).toBe('late');
  });

  it('reason null and remainingMinutes set while under every boundary', async () => {
    const deps = makeDeps({
      settings: withSettings({
        p1: { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30, playUntil: '20:00' },
      }),
    });
    const status = await checkActivityGate(deps, 'p1');
    expect(status.reason).toBeNull();
    expect(status.remainingMinutes).toBe(30); // daily limit (30 left) < hours-until-20:00 (600)
  });

  it('an active hoursOverrideUntil lifts a late gate back to reason null', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, playUntil: '09:00' } }),
      rewards: makeRewardsRepo([
        {
          id: 'l1',
          profileId: 'p1',
          date: '2026-01-05',
          minutes: 0,
          hoursOverrideUntil: new Date(2026, 0, 5, 10, 10, 0).toISOString(), // 10 min after NOW
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ]),
    });
    const status = await checkActivityGate(deps, 'p1'); // NOW = 10:00, override until 10:10
    expect(status.reason).toBeNull();
    expect(status.overLimit).toBe(false);
  });
});

describe('grantHoursOverride', () => {
  it('sets hoursOverrideUntil to now + HOURS_OVERRIDE_MINUTES on a fresh row', async () => {
    const deps = makeDeps();
    const log = await grantHoursOverride(deps, 'p1');
    expect(log.hoursOverrideUntil).toBe(new Date(2026, 0, 5, 10, 15, 0).toISOString());
  });

  it('lifts a gated late/early profile back under the gate', async () => {
    const deps = makeDeps({
      settings: withSettings({ p1: { ...DEFAULT_PROFILE_SETTINGS, playUntil: '09:00' } }),
    });
    expect((await checkActivityGate(deps, 'p1')).reason).toBe('late');
    await grantHoursOverride(deps, 'p1');
    expect((await checkActivityGate(deps, 'p1')).reason).toBeNull();
  });

  it('throws without deps.rewards wired up', async () => {
    const deps = makeDeps({ rewards: undefined });
    await expect(grantHoursOverride(deps, 'p1')).rejects.toThrow();
  });
});

describe('markTimeWarning', () => {
  it('sets warnedAt to now on a fresh row', async () => {
    const deps = makeDeps();
    const log = await markTimeWarning(deps, 'p1');
    expect(log.warnedAt).toBe(NOW.toISOString());
  });

  it('throws without deps.rewards wired up', async () => {
    const deps = makeDeps({ rewards: undefined });
    await expect(markTimeWarning(deps, 'p1')).rejects.toThrow();
  });
});
