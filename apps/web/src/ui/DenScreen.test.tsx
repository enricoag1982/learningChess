import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getLessonProgress } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';

afterEach(cleanup);

function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

describe('DenScreen', () => {
  it('shows every friend unearned and the Pawn rank current, with nothing played', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    expect(
      screen.getByRole('listitem', { name: 'Rhino, locked, finish the Rook lesson' }),
    ).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Pawn, You are here' })).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Knight, After World 2' })).toBeTruthy();
  });

  it('marks Rhino a friend once the Rook lesson is complete', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const rook = services.deps.content.lesson('rook');
    if (!rook) throw new Error('bundled content: "rook" lesson not found');
    const saved = await getLessonProgress(services.deps, profile.id, rook.id);
    const bestStars = Object.fromEntries(
      rook.exercises.map((exercise) => [exercise.id, 1 as const]),
    );
    await services.deps.progress.saveLesson({ ...saved, bestStars });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    expect(screen.getByRole('listitem', { name: 'Rhino, friend' })).toBeTruthy();
    // Only Rhino's own lesson counts: Elephant (Bishop lesson) is still unearned.
    expect(
      screen.getByRole('listitem', { name: 'Elephant, locked, finish the Bishop lesson' }),
    ).toBeTruthy();
  });

  it('shows every badge locked with its condition, and no streak yet, on a fresh profile', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    expect(screen.getByText('Badges')).toBeTruthy();
    expect(screen.getByText('Milestones')).toBeTruthy();
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.getByText('Play')).toBeTruthy();
    expect(screen.getByText('Habits')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'First Win, locked. Win a game vs the computer' }),
    ).toBeTruthy();
    expect(screen.getByText('Play today to start a streak!')).toBeTruthy();
  });

  it('shows an earned badge in colour, with its tier, and a "new" dot until tapped', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const now = new Date().toISOString();
    await services.deps.rewards?.addEarnedBadge({
      id: 'eb1',
      profileId: profile.id,
      badgeId: 'star-collector',
      tier: 'bronze',
      at: now,
      seen: false,
      createdAt: now,
      updatedAt: now,
    });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    const tile = screen.getByRole('button', { name: 'Star Collector, Bronze tier, earned' });
    expect(tile).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();

    fireEvent.click(tile);
    await waitFor(() => {
      expect(screen.queryByText('New')).toBeNull();
    });
  });

  it('shows the streak pill with current + best once a streak exists', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const now = new Date().toISOString();
    await services.deps.rewards?.saveStreak({
      id: 's1',
      profileId: profile.id,
      current: 4,
      best: 7,
      lastDay: '2026-01-05',
      skipsUsedThisWeek: 0,
      createdAt: now,
      updatedAt: now,
    });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    expect(screen.getByRole('img', { name: '4 day streak' })).toBeTruthy();
    expect(screen.getByText('Best: 7')).toBeTruthy();
  });
});
