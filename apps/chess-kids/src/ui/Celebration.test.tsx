import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EarnedBadge } from '@learn/platform-core';
import { StoreProvider } from '@learn/platform-web/app/store.ts';
import { createTestServices } from '@learn/subject-chess/web/testing/test-services.ts';
import { renderWithStore } from '@learn/platform-web/testing/render-with-store.tsx';
import { chessWeb } from '@learn/subject-chess/web/chess-pack.ts';
import { Celebration } from '@learn/platform-web/ui/Celebration.tsx';

function makeEarnedBadge(overrides: Partial<EarnedBadge> = {}): EarnedBadge {
  const now = new Date().toISOString();
  return {
    id: `eb-${Math.random().toString(36).slice(2)}`,
    profileId: 'unused',
    badgeId: 'first-win',
    at: now,
    seen: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Celebration', () => {
  it('shows nothing when there is no active celebration', async () => {
    const services = createTestServices('bundled');
    await renderWithStore(<Celebration />, services, chessWeb);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the oldest unseen badge and clears it on Continue', async () => {
    const services = createTestServices('bundled');
    const { store } = await renderWithStore(<Celebration />, services, chessWeb);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('no profile');

    await services.deps.rewards?.addEarnedBadge(
      makeEarnedBadge({ id: 'eb1', profileId, badgeId: 'first-win' }),
    );
    await store.getState().checkForCelebrations();

    await screen.findByRole('alertdialog', { name: 'New badge!' });
    expect(screen.getByText('First Win')).toBeTruthy();
    expect(store.getState().celebrationsShownThisSession).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(store.getState().activeCelebration).toBeNull();
    });
    expect(store.getState().celebrationsShownThisSession).toBe(1);
  });

  it('shows a tiered badge with its tier label', async () => {
    const services = createTestServices('bundled');
    const { store } = await renderWithStore(<Celebration />, services, chessWeb);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('no profile');

    await services.deps.rewards?.addEarnedBadge(
      makeEarnedBadge({ id: 'eb1', profileId, badgeId: 'star-collector', tier: 'gold' }),
    );
    await store.getState().checkForCelebrations();

    await screen.findByRole('alertdialog', { name: 'New badge!' });
    expect(screen.getByText('Star Collector')).toBeTruthy();
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('caps celebrations at 2 per session: a 3rd unseen badge does not auto-show', async () => {
    const services = createTestServices('bundled');
    const { store } = await renderWithStore(<Celebration />, services, chessWeb);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('no profile');

    for (const badgeId of ['first-win', 'mouse-tamer', 'rabbit-catcher']) {
      await services.deps.rewards?.addEarnedBadge(makeEarnedBadge({ profileId, badgeId }));
    }
    await store.getState().checkForCelebrations();
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // The 2nd celebration is queued automatically by `dismissCelebration` itself.
    await waitFor(() => {
      expect(store.getState().celebrationsShownThisSession).toBe(1);
    });
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(store.getState().celebrationsShownThisSession).toBe(2);
    });
    expect(store.getState().activeCelebration).toBeNull();

    // A later check finds the 3rd still unseen, but the cap keeps it from becoming active.
    await store.getState().checkForCelebrations();
    expect(store.getState().activeCelebration).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(store.getState().earnedBadges.some((badge) => !badge.seen)).toBe(true);
  });
});

describe('Celebration (no active celebration in a plain StoreProvider render)', () => {
  it('renders null without throwing when used outside renderWithStore helpers', async () => {
    const services = createTestServices('bundled');
    const { createAppStore } = await import('@learn/platform-web/app/store.ts');
    const store = createAppStore(services, chessWeb);
    render(
      <StoreProvider value={store}>
        <Celebration />
      </StoreProvider>,
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
