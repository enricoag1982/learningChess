import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createProfile, updateProfileSettings } from '@chess-kids/core';
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

afterEach(cleanup);

function makeServices(): ReturnType<typeof createTestServices> {
  return createTestServices(
    fixtureContentSource(fixtureLesson({ exercises: [fixtureExercise()] })),
  );
}

/** From the picker (already showing), opens the parent area with the standard test password. */
async function openParentArea(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Grown-ups/ }));
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value: '1234' } });
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
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    await within(dialog).findByText('Wrong password.');

    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: '1234' } });
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

describe('Parent area backup (M5.1)', () => {
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
    expect(screen.queryByText(/Replace all data/)).toBeNull();
  });

  it('previews a valid file (profile count, stars), then replaces all data on confirm', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));

    const backupJson = JSON.stringify({
      app: 'chess-kids',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles: [],
      data: {},
    });
    const input = await screen.findByLabelText('Choose file');
    const file = new File([backupJson], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText('0 children, 0 stars');
    fireEvent.click(screen.getByRole('button', { name: 'Replace all data' }));

    await screen.findByText('Import complete.');
    expect(await services.deps.profiles.list()).toEqual([]);
  });
});
