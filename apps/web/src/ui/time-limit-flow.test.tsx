import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { localDayString, updateProfileSettings } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../testing/fixtures.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';
import { createTestServices } from '../testing/test-services.ts';

afterEach(cleanup);

function makeServices(): ReturnType<typeof createTestServices> {
  return createTestServices(
    fixtureContentSource(fixtureLesson({ exercises: [fixtureExercise()] })),
  );
}

/** Seeds today's session log straight at (or past) `minutes` played — "no real waiting" (the lead's
 * own note): the gate reads this the same way it would real logged minutes. */
async function seedMinutesToday(
  services: ReturnType<typeof createTestServices>,
  profileId: string,
  minutes: number,
): Promise<void> {
  const now = services.deps.clock.now();
  await services.deps.rewards?.saveSessionLog({
    id: 'seed-log',
    profileId,
    date: localDayString(now),
    minutes,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

describe('Daily time limit — activity gate (M5.2)', () => {
  it('blocks a new lesson with "See you tomorrow" once the profile is over its daily limit', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 15 });
    await seedMinutesToday(services, profile.id, 15);

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // Home first
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));

    await screen.findByRole('heading', { name: 'See you tomorrow!' });
    // Never opened the lesson underneath it.
    expect(screen.queryByRole('button', { name: /Let me try/ })).toBeNull();
  });

  it('never interrupts a running lesson: only checked again on leaving it, not mid-activity', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 15 });
    // Under the limit right now: the lesson opens normally.
    await seedMinutesToday(services, profile.id, 10);

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));
    await screen.findByRole('button', { name: /Let me try/ }); // in the lesson's Story step

    // Time passes mid-lesson, now over the limit — the open lesson is untouched by it.
    await seedMinutesToday(services, profile.id, 15);
    fireEvent.click(screen.getByRole('button', { name: /Let me try/ })); // Story -> Demo
    await screen.findByRole('button', { name: /^Next/ });
    expect(screen.queryByRole('heading', { name: 'See you tomorrow!' })).toBeNull();

    // Only leaving the lesson (returning to Home) re-checks the gate.
    fireEvent.click(screen.getByRole('button', { name: 'Close lesson' }));
    await screen.findByRole('heading', { name: 'See you tomorrow!' });
  });

  it('a correct parent password grants more time and resumes the exact activity that was gated', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 15 });
    await seedMinutesToday(services, profile.id, 15);

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));
    await screen.findByRole('heading', { name: 'See you tomorrow!' });

    fireEvent.click(screen.getByRole('button', { name: 'Parent: more time' }));
    fireEvent.change(await screen.findByLabelText('Parent code', { exact: true }), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    // Resumes straight into the lesson that was gated — no extra confirmation screen in between.
    await screen.findByRole('button', { name: /Let me try/ });

    const log = await services.deps.rewards?.getSessionLog(
      profile.id,
      localDayString(services.deps.clock.now()),
    );
    expect(log?.extraMinutes).toBe(15);
  });

  it('"Switch player" from "See you tomorrow" opens the profile picker', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 15 });
    await seedMinutesToday(services, profile.id, 15);

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));
    await screen.findByRole('heading', { name: 'See you tomorrow!' });

    fireEvent.click(screen.getByRole('button', { name: 'Switch player' }));
    await screen.findByRole('heading', { name: "Who's playing today?" });
  });

  it('the daily limit off (default) never gates any activity', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await seedMinutesToday(services, profile.id, 999); // a lot of minutes, limit stays off

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));

    await screen.findByRole('button', { name: /Let me try/ });
  });
});
