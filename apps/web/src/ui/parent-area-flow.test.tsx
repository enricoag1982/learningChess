import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createProfile, DEFAULT_PROFILE_SETTINGS, updateProfileSettings } from '@chess-kids/core';
import type { BackupFile } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import type { FakeBackupFileWriter } from '../testing/fake-backup-file-writer.ts';
import type { FakeNarrator } from '../testing/fake-narrator.ts';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../testing/fixtures.ts';
import {
  pickProfileFromPicker,
  seedReturningProfile,
  seedWorldFourMastered,
} from '../testing/app-test-helpers.ts';
import { createTestServices } from '../testing/test-services.ts';
import type { FakePasswordFileWriter } from '../testing/fake-password-file-writer.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A minimal, valid incoming `BackupFile` for one child (M7.2 device sharing tests). */
function incomingFileFor(
  profileOverrides: { readonly id: string; readonly nickname: string; readonly avatar?: string },
  dataOverrides: Partial<BackupFile['data'][string]> = {},
): BackupFile {
  const now = new Date().toISOString();
  const profile = {
    id: profileOverrides.id,
    accountId: 'local',
    nickname: profileOverrides.nickname,
    avatar: profileOverrides.avatar ?? 'panda',
    locale: 'en',
    createdAt: now,
    updatedAt: now,
  };
  return {
    app: 'chess-kids',
    schemaVersion: 1,
    exportedAt: now,
    profiles: [profile],
    data: {
      [profile.id]: {
        settings: DEFAULT_PROFILE_SETTINGS,
        lessonProgress: [],
        attempts: [],
        miniGameProgress: [],
        conceptStats: [],
        gameRecords: [],
        earnedBadges: [],
        sessionLogs: [],
        assessmentResults: [],
        unlocks: [],
        ...dataOverrides,
      },
    },
  };
}

function makeServices(): ReturnType<typeof createTestServices> {
  return createTestServices(
    fixtureContentSource(fixtureLesson({ exercises: [fixtureExercise()] })),
  );
}

/** From the picker (already showing), opens the parent area with the standard test password. */
async function openParentArea(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Grown-ups/ }));
  fireEvent.change(await screen.findByLabelText('Parent code'), { target: { value: '1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  await screen.findByRole('heading', { name: 'Parent area' });
}

/** Overview -> that child's card -> Report. */
async function openReport(nickname: string): Promise<void> {
  const card = screen.getByText(nickname).closest('button');
  if (!card) throw new Error(`${nickname} card not found`);
  fireEvent.click(card);
  await screen.findByRole('button', { name: 'Settings' });
}

/** Overview -> that child's card -> Report -> Settings. */
async function openSettings(nickname: string): Promise<void> {
  await openReport(nickname);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  await screen.findByRole('button', { name: 'Rename' });
}

describe('Parent area overview (M5.1)', () => {
  it('shows one card per child with avatar/nickname/rank/stars/minutes/streak, tapping opens the report', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    await createProfile(services.deps, 'Leo', 'panda');
    render(<App services={services} />);
    await openParentArea();

    await screen.findByText('Mia');
    await screen.findByText('Leo');
    expect(screen.getAllByText('0 stars')).toHaveLength(2);

    await openReport('Mia');
    await screen.findByText('Progress by world');
  });
});

describe('Parent area child report (M5.1)', () => {
  it('shows progress by world, and empty states for games/badges/assessments for a fresh child', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    const now = new Date().toISOString();
    await services.deps.progress.saveLesson({
      id: 'lp1',
      profileId: profile.id,
      lessonId: 'fixture',
      bestStars: { 'fixture-ex': 3 },
      bossStars: 0,
      resumeStep: 0,
      createdAt: now,
      updatedAt: now,
    });
    render(<App services={services} />);
    await openParentArea();
    await openReport('Mia');

    await screen.findByText('1/1 lessons complete');
    await screen.findByText('No games played yet.');
    await screen.findByText('No badges earned yet.');
    await screen.findByText('No test-out or placement runs yet.');
  });

  it("shows the daily limit as a line under the minutes-per-day chart's heading (M5.2)", async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 30 });
    render(<App services={services} />);
    await openParentArea();
    await openReport('Mia');

    await screen.findByText('Daily limit: 30 min (line on the chart)');
  });

  it('shows no daily-limit line for a profile with the limit off', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    await openReport('Mia');

    await screen.findByText('Minutes per day (last 14 days)');
    expect(screen.queryByText(/Daily limit:/)).toBeNull();
  });
});

describe('Parent area settings effects (M5.1)', () => {
  it('daily limit choice persists after leaving and reopening settings', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    await openSettings('Mia');

    fireEvent.click(await screen.findByRole('button', { name: '30 min' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '30 min' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // settings -> report
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' })); // report -> settings

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '30 min' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('voice off stops the Home Owl greeting from being spoken after the profile is next selected', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    await openSettings('Mia');

    fireEvent.click(screen.getByRole('switch', { name: 'Voice' }));
    await waitFor(async () => {
      const settings = await services.deps.settings.get();
      expect(settings.profileSettings[profile.id]?.voice).toBe(false);
    });
    // Nothing spoken from here on counts — including whatever the app already spoke on its very
    // first screens (e.g. the picker), before this profile (or its voice setting) was ever
    // selected the first time.
    const narrator = services.narrator as unknown as FakeNarrator;
    const spokenSoFar = narrator.spoken.length;

    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // settings -> report
    fireEvent.click(await screen.findByRole('button', { name: 'Back' })); // report -> overview
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await pickProfileFromPicker('Mia');

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // Home
    expect(narrator.spoken.length).toBe(spokenSoFar);
  });

  it('a fixed computer level preselects that level on the Play screen', async () => {
    const services = createTestServices(createBundledContentSource());
    const profile = await seedReturningProfile(services, 'Mia');
    await seedWorldFourMastered(services, profile.id); // unlocks Mouse
    await updateProfileSettings(services.deps, profile.id, { computerLevel: 1 });
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Play/ }));
    await screen.findByRole('heading', { name: 'Play' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Mouse,/ }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });
});

describe('Parent area weekend and hours limits (M7.1)', () => {
  it('weekend toggle off shows one "Every day" row; toggling on shows Mon–Fri / Sat–Sun rows, each saving its own limit', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    await openSettings('Mia');

    expect(screen.getByRole('group', { name: 'Every day' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Mon–Fri' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Sat–Sun' })).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: 'Different limit at the weekend' }));

    const weekdayGroup = await screen.findByRole('group', { name: 'Mon–Fri' });
    const weekendGroup = screen.getByRole('group', { name: 'Sat–Sun' });
    expect(screen.queryByRole('group', { name: 'Every day' })).toBeNull();

    fireEvent.click(within(weekdayGroup).getByRole('button', { name: '30 min' }));
    fireEvent.click(within(weekendGroup).getByRole('button', { name: '60 min' }));

    await waitFor(async () => {
      const settings = await services.deps.settings.get();
      expect(settings.profileSettings[profile.id]?.dailyLimitMinutes).toBe(30);
      expect(settings.profileSettings[profile.id]?.weekendLimitMinutes).toBe(60);
    });
  });

  it('toggling the weekend limit back off removes weekendLimitMinutes (back to "Every day")', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { weekendLimitMinutes: 45 });
    render(<App services={services} />);
    await openParentArea();
    await openSettings('Mia');

    await screen.findByRole('group', { name: 'Sat–Sun' });
    fireEvent.click(screen.getByRole('switch', { name: 'Different limit at the weekend' }));

    await waitFor(async () => {
      const settings = await services.deps.settings.get();
      expect(settings.profileSettings[profile.id]?.weekendLimitMinutes).toBeUndefined();
    });
    expect(screen.queryByRole('group', { name: 'Sat–Sun' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Every day' })).toBeTruthy();
  });

  it('"Play until" / "Not before" chips save', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    await openSettings('Mia');

    const untilGroup = screen.getByRole('group', { name: 'Play until' });
    const fromGroup = screen.getByRole('group', { name: 'Not before' });
    fireEvent.click(within(untilGroup).getByRole('button', { name: '20:00' }));
    fireEvent.click(within(fromGroup).getByRole('button', { name: '08:00' }));

    await waitFor(async () => {
      const settings = await services.deps.settings.get();
      expect(settings.profileSettings[profile.id]?.playUntil).toBe('20:00');
      expect(settings.profileSettings[profile.id]?.playFrom).toBe('08:00');
    });
  });

  it('shows the active rules line under the minutes-per-day chart', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, {
      dailyLimitMinutes: 30,
      weekendLimitMinutes: 60,
      playUntil: '20:00',
    });
    render(<App services={services} />);
    await openParentArea();
    await openReport('Mia');

    await screen.findByText('Mon–Fri 30 min · Sat–Sun 60 min · until 20:00');
  });
});

describe('Parent area reset (M5.1)', () => {
  it('requires the parent password, rejects a wrong one, and clears progress on the right one', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    const now = new Date().toISOString();
    await services.deps.progress.saveLesson({
      id: 'lp1',
      profileId: profile.id,
      lessonId: 'fixture',
      bestStars: { 'fixture-ex': 3 },
      bossStars: 0,
      resumeStep: 0,
      createdAt: now,
      updatedAt: now,
    });
    render(<App services={services} />);
    await openParentArea();
    await openSettings('Mia');

    fireEvent.click(screen.getByRole('button', { name: 'Reset progress' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Parent code'), { target: { value: 'nope' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    await within(dialog).findByText('Wrong code.');

    fireEvent.change(within(dialog).getByLabelText('Parent code'), { target: { value: '1234' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));

    await screen.findByText('Progress reset.');
    expect(await services.deps.progress.listLessons(profile.id)).toEqual([]);
  });
});

describe('Parent area privacy and version (M5.5)', () => {
  it('shows the app version on the overview, and the Privacy row opens the same policy text', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();

    await screen.findByText(`Version ${__APP_VERSION__}`);

    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    await screen.findByRole('heading', { name: 'Privacy' });
    expect(screen.getByText(/Chess for Kids keeps everything on this device/)).toBeTruthy();
    expect(screen.getByText(/No sign-up, no analytics, no ads/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Parent area' });
  });
});

describe('Parent code file (owner request 2026-09-25)', () => {
  it('"Download code file" writes the current code again and says where', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    const writer = services.deps.passwordFile as FakePasswordFileWriter;
    const writesBefore = writer.writes.length;

    fireEvent.click(screen.getByRole('button', { name: 'Download code file' }));

    await screen.findByText('Saved a copy: Downloads/chess-for-kids-parent-code.txt');
    expect(writer.writes.length).toBe(writesBefore + 1);
    expect(writer.writes.at(-1)).toBe('1234');
  });
});

describe('Parent area backup — export (M5.1)', () => {
  it('export all writes one file via the backup file writer', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();

    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Export all' }));

    await waitFor(() => {
      const writer = services.deps.backupFileWriter as FakeBackupFileWriter;
      expect(writer.writes).toHaveLength(1);
      expect(writer.writes[0]?.filename).toMatch(/^chess-kids-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });
});

describe('Parent area — Send to other device (M7.2 device sharing)', () => {
  it('shares a file via the Web Share API when the browser can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Send to other device' }));

    await screen.findByText('Sent.');
    expect(share).toHaveBeenCalledTimes(1);
    const [payload] = share.mock.calls[0] as [{ files: File[] }];
    expect(payload.files[0]?.name).toMatch(/^chess-for-kids-all-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('falls back to a download when file sharing is unavailable (Safari 15.4)', async () => {
    vi.stubGlobal(
      'navigator',
      Object.assign({}, navigator, { share: undefined, canShare: undefined }),
    );
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Send to other device' }));

    await screen.findByText('Saved a copy: Downloads');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('a user cancel (AbortError) is silent — no note, no download fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Send to other device' }));

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Send to other device' });
      expect(button.hasAttribute('disabled')).toBe(false);
    });
    expect(screen.queryByText('Sent.')).toBeNull();
    expect(screen.queryByText(/Saved a copy/)).toBeNull();
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe('Parent area import — merge (M7.2 device sharing)', () => {
  it('shows a clear error for an invalid file, changing nothing', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    const input = await screen.findByLabelText('Choose file');
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText('Not a valid backup file (invalid JSON).');
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });

  it('auto-merges a child whose id matches a local profile, no choice shown, folds its stars in', async () => {
    const services = makeServices();
    const mia = await seedReturningProfile(services, 'Mia');
    const incoming = incomingFileFor(
      { id: mia.id, nickname: 'Mia' },
      {
        lessonProgress: [
          {
            id: 'lp-other-device',
            profileId: mia.id,
            lessonId: 'fixture',
            bestStars: { 'fixture-ex': 3 },
            bossStars: 0,
            resumeStep: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    );
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    const input = await screen.findByLabelText('Choose file');
    const file = new File([JSON.stringify(incoming)], 'share.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText('Merging into Mia');
    expect(screen.queryByRole('combobox')).toBeNull(); // no choice control ("no question")

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await screen.findByText('Import complete.');

    const merged = await services.deps.progress.listLessons(mia.id);
    expect(merged[0]?.bestStars).toEqual({ 'fixture-ex': 3 });
  });

  it('defaults an unmatched child to "Add as new child"; confirming adds it alongside the existing child', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    const incoming = incomingFileFor({ id: 'other-device-leo', nickname: 'Leo' });
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    const input = await screen.findByLabelText('Choose file');
    const file = new File([JSON.stringify(incoming)], 'share.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    const select = await screen.findByRole('combobox');
    expect((select as HTMLSelectElement).value).toBe('add-new');

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await screen.findByText('Import complete.');

    const profiles = await services.deps.profiles.list();
    expect(profiles.map((p) => p.nickname).sort()).toEqual(['Leo', 'Mia']);
  });

  it('preselects "Merge into" when the incoming nickname matches a local child', async () => {
    const services = makeServices();
    const mia = await seedReturningProfile(services, 'Mia');
    const incoming = incomingFileFor({ id: 'other-device-mia', nickname: 'mia' }); // case differs
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    const input = await screen.findByLabelText('Choose file');
    const file = new File([JSON.stringify(incoming)], 'share.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    const select = await screen.findByRole('combobox');
    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe(mia.id);
    });
  });
});
