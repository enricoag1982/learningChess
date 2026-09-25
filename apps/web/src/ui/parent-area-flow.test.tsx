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
