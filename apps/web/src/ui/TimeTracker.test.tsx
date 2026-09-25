import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { localDayString } from '@chess-kids/core';
import '../i18n.ts';
import { createAppStore, StoreProvider } from '../app/store.ts';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { createTestServices } from '../testing/test-services.ts';
import { TimeTracker } from './TimeTracker.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

/** `SessionLog.minutes` for the active profile's own today's row, `0` without one yet. */
async function loggedMinutes(
  services: ReturnType<typeof createTestServices>,
  profileId: string,
): Promise<number> {
  const date = localDayString(services.deps.clock.now());
  const log = await services.deps.rewards?.getSessionLog(profileId, date);
  return log?.minutes ?? 0;
}

describe('TimeTracker (M5.2)', () => {
  it('adds one minute to the session log every real minute while visible and active', async () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await renderWithStore(<TimeTracker />, services);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('renderWithStore: no profile selected');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(await loggedMinutes(services, profileId)).toBe(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(await loggedMinutes(services, profileId)).toBe(2);
  });

  it('pauses while the page is hidden', async () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await renderWithStore(<TimeTracker />, services);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('renderWithStore: no profile selected');

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await loggedMinutes(services, profileId)).toBe(0);
  });

  it('pauses once idle for more than 2 minutes without input', async () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await renderWithStore(<TimeTracker />, services);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('renderWithStore: no profile selected');

    // No input after mount: minute 1 and 2 still count (< 2 minutes idle so far), minute 3 does not
    // (now > 2 minutes since the last — mount-time — activity).
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await loggedMinutes(services, profileId)).toBe(2);
  });

  it('a tap resets the idle clock, resuming ticks', async () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await renderWithStore(<TimeTracker />, services);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('renderWithStore: no profile selected');

    await vi.advanceTimersByTimeAsync(150_000); // 2.5 min idle: only the first tick counts (2)
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(60_000); // fresh minute since the tap
    expect(await loggedMinutes(services, profileId)).toBe(3);
  });

  it('does not track a parent-gate screen (password/parent area)', async () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await renderWithStore(<TimeTracker />, services);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('renderWithStore: no profile selected');

    store.setState({ screen: 'password' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await loggedMinutes(services, profileId)).toBe(0);
  });

  it('keeps counting across screen changes shorter than a minute', async () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await renderWithStore(<TimeTracker />, services);
    const profileId = store.getState().profile?.id;
    if (!profileId) throw new Error('renderWithStore: no profile selected');

    await vi.advanceTimersByTimeAsync(40_000);
    act(() => {
      store.setState({ screen: 'journey' });
    });
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await loggedMinutes(services, profileId)).toBe(1);
  });

  it('renders nothing and does no-op without a selected profile', () => {
    vi.useFakeTimers();
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const store = createAppStore(services);
    const { container } = render(
      <StoreProvider value={store}>
        <TimeTracker />
      </StoreProvider>,
    );
    expect(container.innerHTML).toBe('');
  });
});
