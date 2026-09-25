import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { lessonSteps, localDayString, updateProfileSettings } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import type { FakeNarrator } from '../testing/fake-narrator.ts';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../testing/fixtures.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { createTestServices } from '../testing/test-services.ts';
import { AppNotice } from './AppNotice.tsx';

/** Five-minute warning's own kid-facing text (`notice.five-minutes`), spoken and shown verbatim. */
const FIVE_MINUTES_TEXT = '5 minutes left — pick something short!';

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
    fireEvent.change(await screen.findByLabelText('Password', { exact: true }), {
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

describe('Allowed hours gate (M7.1)', () => {
  it('late: past playUntil shows "Time to rest!", parent password grants an hours override and resumes', async () => {
    const services = makeServices();
    services.deps.clock.now = () => new Date(2026, 0, 5, 20, 30, 0); // 20:30 local
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { playUntil: '20:00' });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // Home first
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));

    await screen.findByRole('heading', { name: 'Time to rest!' });
    await screen.findByText("It's getting late. See you tomorrow!");

    fireEvent.click(screen.getByRole('button', { name: 'Parent: more time' }));
    fireEvent.change(await screen.findByLabelText('Password', { exact: true }), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    // Resumes straight into the gated lesson — no confirmation screen in between.
    await screen.findByRole('button', { name: /Let me try/ });

    const log = await services.deps.rewards?.getSessionLog(
      profile.id,
      localDayString(services.deps.clock.now()),
    );
    expect(log?.hoursOverrideUntil).toBe(new Date(2026, 0, 5, 20, 45, 0).toISOString());
    expect(log?.extraMinutes ?? 0).toBe(0); // the hours grant, not the daily-limit one
  });

  it('early: before playFrom shows "Too early!" with the opening time', async () => {
    const services = makeServices();
    services.deps.clock.now = () => new Date(2026, 0, 5, 6, 0, 0); // 06:00 local
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { playFrom: '07:00' });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // Home first
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));

    await screen.findByRole('heading', { name: 'Too early!' });
    await screen.findByText('Chess opens at 07:00. See you soon!');
  });

  it('shows the right time even when playFrom changes after the profile was already selected', async () => {
    // Regression guard: `activeProfileSettings` only refreshes at profile *selection*
    // (app-structure.md §11 "Settings effect now"), so the gate's own text must not read it —
    // it reads `TimeLimitStatus.playFrom` instead (`checkActivityGate`'s own fresh read).
    const services = makeServices();
    services.deps.clock.now = () => new Date(2026, 0, 5, 6, 0, 0); // 06:00 local
    const profile = await seedReturningProfile(services, 'Mia');

    render(<App services={services} />);
    await pickProfileFromPicker('Mia'); // activeProfileSettings loaded now, playFrom absent
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });

    // Changed only now — after selection, so `activeProfileSettings` in the store stays stale.
    await updateProfileSettings(services.deps, profile.id, { playFrom: '07:00' });

    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));
    await screen.findByRole('heading', { name: 'Too early!' });
    await screen.findByText('Chess opens at 07:00. See you soon!');
  });
});

describe('5-minute warning notice (M7.1)', () => {
  it('shows on Home once ≤5 min are left, spoken once, not on an exercise screen, at the next calm screen, not again the same day', async () => {
    const services = makeServices();
    const profile = await seedReturningProfile(services, 'Mia');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 15 });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // Home

    // Nowhere near the limit yet: no banner.
    expect(screen.queryByText(FIVE_MINUTES_TEXT)).toBeNull();

    // Enter the lesson (non-calm: the Story step) and cross the threshold while there.
    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));
    await screen.findByRole('button', { name: /Let me try/ });
    await seedMinutesToday(services, profile.id, 10); // remaining = 15 - 10 = 5

    expect(screen.queryByText(FIVE_MINUTES_TEXT)).toBeNull();

    // Leaving the lesson (screen change to Home) shows it.
    fireEvent.click(screen.getByRole('button', { name: 'Close lesson' }));
    await screen.findByText(FIVE_MINUTES_TEXT);
    expect(screen.getByRole('status').textContent).toContain(FIVE_MINUTES_TEXT);

    const narrator = services.narrator as unknown as FakeNarrator;
    expect(narrator.spoken.filter((text) => text === FIVE_MINUTES_TEXT)).toHaveLength(1);

    // Gone on the next screen change, and never shown again the same day.
    fireEvent.click(screen.getByRole('button', { name: 'Journey' }));
    await screen.findByRole('button', { name: 'Back to Home' });
    expect(screen.queryByText(FIVE_MINUTES_TEXT)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    expect(screen.queryByText(FIVE_MINUTES_TEXT)).toBeNull();
    expect(narrator.spoken.filter((text) => text === FIVE_MINUTES_TEXT)).toHaveLength(1);
  });

  it('the lesson screen counts as calm only on its own lesson-complete step', async () => {
    const services = makeServices();
    const { store } = await renderWithStore(<AppNotice />, services);
    const profile = store.getState().profile;
    if (!profile) throw new Error('renderWithStore: no profile selected');
    await updateProfileSettings(services.deps, profile.id, { dailyLimitMinutes: 15 });
    await seedMinutesToday(services, profile.id, 10); // remaining = 5, already under the threshold

    const lesson = services.deps.content.lesson('fixture');
    if (!lesson) throw new Error('fixture lesson not found');
    const steps = lessonSteps(lesson, services.deps.content.minigames());
    const completeIndex = steps.findIndex((step) => step.kind === 'complete');
    expect(completeIndex).toBeGreaterThan(-1);

    act(() => {
      store.setState({ screen: 'lesson', lessonId: lesson.id, stepIndex: 0 });
    });
    await waitFor(() => {
      expect(store.getState().timeNoticeVisible).toBe(false);
    });

    act(() => {
      store.setState({ screen: 'lesson', lessonId: lesson.id, stepIndex: completeIndex });
    });
    await screen.findByText(FIVE_MINUTES_TEXT);
  });
});
