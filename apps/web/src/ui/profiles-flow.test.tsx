import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createProfile } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { createTestServices } from '../testing/test-services.ts';
import type { FakePasswordFileWriter } from '../testing/fake-password-file-writer.ts';
import { seedReturningProfile } from '../testing/app-test-helpers.ts';

afterEach(cleanup);

function makeServices(): ReturnType<typeof createTestServices> {
  return createTestServices(fixtureContentSource(fixtureLesson()));
}

/** From the picker (already showing), opens the password screen. */
async function openGrownUps(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Grown-ups/ }));
  await screen.findByRole('heading', { name: 'Grown-ups' });
}

function enterPassword(password: string): void {
  fireEvent.change(screen.getByLabelText('Parent code'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
}

describe('first run', () => {
  it('welcome → password → saved → new player → placement offer → Home (fresh install)', async () => {
    const services = makeServices();
    render(<App services={services} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Start setup' }));

    fireEvent.change(await screen.findByLabelText('Parent code'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Repeat parent code'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save parent code' }));

    await screen.findByText('Parent code saved!');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.change(await screen.findByPlaceholderText('Your name'), {
      target: { value: 'Mia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Pick your animal!');
    fireEvent.click(screen.getByRole('button', { name: "Let's play!" }));

    // domain-model.md §3.2: offered once, right after creating a new player.
    await screen.findByText("Already know some chess? Let's find out where to start you!");
    fireEvent.click(screen.getByRole('button', { name: 'No, start at World 1' }));

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('an existing M1 profile with no parent lock skips new-player, goes straight to Home', async () => {
    const services = makeServices();
    await createProfile(services.deps, 'Player', 'fox'); // simulates an M1 install's lone profile
    render(<App services={services} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Start setup' }));
    fireEvent.change(await screen.findByLabelText('Parent code'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Repeat parent code'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save parent code' }));
    await screen.findByText('Parent code saved!');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    expect(screen.getByText('Player')).toBeTruthy();
    expect(screen.queryByText('Pick your animal!')).toBeNull();
  });

  it('the privacy policy link opens an in-screen dialog (no new store screen), closable, keeping the password step underneath (M5.5)', async () => {
    const services = makeServices();
    render(<App services={services} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start setup' }));
    await screen.findByRole('heading', { name: 'Set a parent code' });

    fireEvent.click(screen.getByRole('button', { name: 'Read our privacy policy' }));
    const dialog = await screen.findByRole('dialog', { name: 'Privacy' });
    await within(dialog).findByText(/Chess for Kids keeps everything on this device/);
    expect(within(dialog).getByText(/No sign-up, no analytics, no ads/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('heading', { name: 'Set a parent code' })).toBeTruthy();
  });
});

describe('password screen', () => {
  it('wrong password up to 4 times counts attempts, the 5th locks with a countdown', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await openGrownUps();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      enterPassword('nope');
      await screen.findByText(`Wrong parent code (${String(attempt)} of 5)`);
    }

    enterPassword('nope');
    await screen.findByText(/Try again in \d:\d\d/);
    const openButton = screen.getByRole('button', { name: 'Open' });
    expect(openButton).toHaveProperty('disabled', true);
  });

  it('the right password opens the parent area', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await openGrownUps();

    enterPassword('1234');

    await screen.findByRole('heading', { name: 'Parent area' });
    // M5.1 overview cards load after the (lazy, M5.4) screen mounts.
    expect(await screen.findByText('Mia')).toBeTruthy();
  });

  it('back returns to the picker', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await openGrownUps();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await screen.findByRole('heading', { name: "Who's playing today?" });
  });
});

describe('parent area', () => {
  async function openParentArea(): Promise<void> {
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await openGrownUps();
    enterPassword('1234');
    await screen.findByRole('heading', { name: 'Parent area' });
  }

  /** Overview → that child's card → Report → "Settings" (M5.1: rename/avatar/delete moved there). */
  async function openChildSettings(nickname: string): Promise<void> {
    const card = screen.getByText(nickname).closest('button');
    if (!card) throw new Error(`${nickname} card not found`);
    fireEvent.click(card);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    await screen.findByRole('button', { name: 'Rename' });
  }

  it('renames a child', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();
    await openChildSettings('Mia');

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByDisplayValue('Mia');
    fireEvent.change(input, { target: { value: 'Mia2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Mia2');
  });

  it('adds a child, then deletes it after confirming', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();

    fireEvent.click(screen.getByRole('button', { name: 'Add child' }));
    fireEvent.change(await screen.findByPlaceholderText('Your name'), {
      target: { value: 'Leo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Pick your animal!');
    fireEvent.click(screen.getByRole('button', { name: "Let's play!" }));

    // Back in the parent area (not Home): adding a child from here must not switch the active player.
    await screen.findByRole('heading', { name: 'Parent area' });
    await screen.findByText('Leo');
    await openChildSettings('Leo');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    within(dialog).getByText('Delete Leo and all progress?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Leo')).toBeNull();
    });
  });

  it('change password calls the password file writer', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();

    fireEvent.click(screen.getByRole('button', { name: 'Change parent code' }));
    fireEvent.change(screen.getByLabelText('New parent code'), { target: { value: '5678' } });
    fireEvent.change(screen.getByLabelText('Repeat parent code'), { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('button', { name: 'Change parent code' }); // form closed again

    const writer = services.deps.passwordFile as FakePasswordFileWriter;
    expect(writer.writes).toContain('5678');
  });

  it('Done returns to the picker', async () => {
    const services = makeServices();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await openParentArea();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await screen.findByRole('heading', { name: "Who's playing today?" });
  });
});
