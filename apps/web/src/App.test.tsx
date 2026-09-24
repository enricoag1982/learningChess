import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import './i18n.ts';
import App from './App.tsx';
import { fixtureContentSource, fixtureLesson } from './testing/fixtures.ts';
import { createTestServices } from './testing/test-services.ts';

afterEach(cleanup);

describe('App', () => {
  it('renders the Home screen, title visible, offline status hidden until a service worker is ready', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    render(<App services={services} />);

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    // jsdom has no `serviceWorker`: the status line never appears there (see e2e for the real case).
    expect(screen.queryByText('Ready to play offline.')).toBeNull();
  });

  it('plays a whole lesson through to Complete; Continue then shows updated total stars at Home', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { container } = render(<App services={services} />);

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

    await screen.findByRole('button', { name: /Play again/ });
    expect(container.querySelector('[aria-label="3 stars"]')).not.toBeNull();
  });
});
