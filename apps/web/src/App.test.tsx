import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import './i18n.ts';
import App from './App.tsx';
import type { AppUpdate } from './adapters/app-update.ts';
import { fixtureContentSource, fixtureLesson } from './testing/fixtures.ts';
import { createTestServices } from './testing/test-services.ts';
import { pickProfileFromPicker, seedReturningProfile } from './testing/app-test-helpers.ts';

afterEach(cleanup);

describe('App', () => {
  it('picker → Home: title visible, offline status hidden until a service worker is ready', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);

    await screen.findByRole('heading', { name: "Who's playing today?" });
    await pickProfileFromPicker('Mia');

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    // jsdom (unit tests) has no `serviceWorker`: the status line never appears there (see e2e).
    expect(screen.queryByText('Ready to play offline.')).toBeNull();
  });

  it('plays a whole lesson through to Complete; Continue then shows updated total stars at Home', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    await seedReturningProfile(services, 'Mia');
    const { container } = render(<App services={services} />);

    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Start/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Let me try/ })); // Story -> Demo
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ })); // Demo -> Exercise

    fireEvent.click(await screen.findByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    fireEvent.click(await screen.findByRole('button', { name: /^Next/ })); // solved -> Complete

    await screen.findByText('Lesson complete!');
    // Regression: Complete must show the stars just earned, not a stale (pre-lesson) progress read.
    await screen.findByText('+3 stars');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    // The lesson was this Today session's only activity: its end is the session summary, not Home
    // directly (M3.4, domain-model.md §3.3).
    await screen.findByText('Great session!');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // Back at Home: the fixture's only lesson is done, so the Journey has nothing left to offer.
    await screen.findByText('You finished everything for now. Come back soon for more!');
    expect(container.querySelector('[aria-label="3 stars"]')).not.toBeNull();
  });

  it('applies a waiting app update only at a safe screen (Home), never mid-lesson', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    let ready = false;
    let applyCount = 0;
    const appUpdate: AppUpdate = {
      isUpdateReady: () => ready,
      apply: () => {
        applyCount += 1;
        return Promise.resolve();
      },
      onUpdateReady: () => () => undefined,
    };
    render(<App services={services} appUpdate={appUpdate} />);

    await screen.findByRole('heading', { name: "Who's playing today?" });
    await pickProfileFromPicker('Mia');
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // Home: a safe screen

    // Home is a safe screen, but the update is not ready yet: nothing applies on arrival.
    expect(applyCount).toBe(0);

    fireEvent.click(await screen.findByRole('button', { name: /Start/ }));
    await screen.findByRole('button', { name: /Let me try/ }); // now inside the lesson (Story)

    // The update arrives while mid-lesson: it must wait, not apply immediately.
    ready = true;
    expect(applyCount).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Close lesson' }));
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' }); // back at Home

    expect(applyCount).toBe(1);
  });

  it('applies an update found while already at Home right away (app reopened on Home)', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    let ready = false;
    let applyCount = 0;
    const listeners: (() => void)[] = [];
    const appUpdate: AppUpdate = {
      isUpdateReady: () => ready,
      apply: () => {
        applyCount += 1;
        return Promise.resolve();
      },
      onUpdateReady: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    };
    render(<App services={services} appUpdate={appUpdate} />);
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await pickProfileFromPicker('Mia');
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    expect(applyCount).toBe(0);

    ready = true;
    act(() => {
      for (const listener of listeners) listener();
    });

    expect(applyCount).toBe(1);
  });
});
