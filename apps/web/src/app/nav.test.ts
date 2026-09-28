import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { createProfile, localDayString, updateProfileSettings } from '@chess-kids/core';
import { makeContentSource } from '@chess-kids/core/testing';
import {
  fixtureBoss,
  fixtureCatalog,
  fixtureContentSource,
  fixtureLesson,
} from '../testing/fixtures.ts';
import { seedReturningProfile } from '../testing/app-test-helpers.ts';
import { createTestServices } from '../testing/test-services.ts';
import { chessWeb } from '../chess-pack.ts';
import type { Services } from './services.ts';
import { createAppStore } from './store.ts';
import type { AppStore } from './store.ts';
import { setRoute } from './slices/nav.ts';

/**
 * Store-level coverage of `design-r2-web.md` PR C's flow table (v4 R2 web C, C4b — HIGH RISK):
 * every row drives real store actions over `createAppStore` (no rendering) and asserts on the
 * resulting `stack`. No behaviour change from pre-refactor `store.ts` is the whole point here.
 */

function names(store: AppStore): readonly string[] {
  return store.getState().stack.map((route) => route.name);
}

/** Seeds today's session log straight at `minutes` played, same trick `time-limit-flow.test.tsx` uses. */
async function seedMinutesToday(
  services: Services,
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

/** A store already on Home with one profile selected — the common starting point below. */
async function storeAtHome(
  services: Services,
): Promise<{ readonly store: AppStore; readonly profileId: string }> {
  const profile = await seedReturningProfile(services, 'Mia');
  const store = createAppStore(services, chessWeb);
  await store.getState().selectProfileAndHome(profile.id);
  return { store, profileId: profile.id };
}

describe('Start', () => {
  it('no parent lock yet: resets to first-run', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const store = createAppStore(services, chessWeb);
    await store.getState().init();
    expect(names(store)).toEqual(['first-run']);
  });

  it('a returning device (parent lock set): resets to the picker', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    const store = createAppStore(services, chessWeb);
    await store.getState().init();
    expect(names(store)).toEqual(['picker']);
  });
});

describe('First run done', () => {
  it('no profiles yet: pushes new-player on top of first-run', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const store = createAppStore(services, chessWeb);
    setRoute(store, { name: 'first-run' });
    await store.getState().finishFirstRun();
    expect(names(store)).toEqual(['first-run', 'new-player']);
  });

  it('exactly one existing profile (M1-upgrade path): resets straight to Home', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    const store = createAppStore(services, chessWeb);
    setRoute(store, { name: 'first-run' });
    await store.getState().finishFirstRun();
    expect(names(store)).toEqual(['home']);
  });

  it('more than one profile: resets to the picker', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    await createProfile(services.deps, 'Zoe', 'cat');
    const store = createAppStore(services, chessWeb);
    setRoute(store, { name: 'first-run' });
    await store.getState().finishFirstRun();
    expect(names(store)).toEqual(['picker']);
  });
});

describe('New player from picker', () => {
  it('pushes new-player on the picker; finishing resets to home + placement-offer', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    const store = createAppStore(services, chessWeb);
    await store.getState().goToPicker();
    store.getState().startNewPlayer();
    expect(names(store)).toEqual(['picker', 'new-player']);
    await store.getState().finishNewPlayer('Zoe', 'cat');
    expect(names(store)).toEqual(['home', 'placement-offer']);
  });
});

describe('Add child (parent area)', () => {
  it('pushes new-player on the parent area; finishing pops back to it and refreshes profiles', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    const store = createAppStore(services, chessWeb);
    setRoute(store, { name: 'parent' });
    store.getState().startNewPlayer();
    expect(names(store)).toEqual(['parent', 'new-player']);
    await store.getState().finishNewPlayer('Zoe', 'cat');
    expect(names(store)).toEqual(['parent']);
    expect(store.getState().profiles.some((profile) => profile.nickname === 'Zoe')).toBe(true);
  });
});

describe('Placement', () => {
  it('accept replaces placement-offer with placement; advancing replaces the index; finish gates home', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.getState().reset({ name: 'home' }, { name: 'placement-offer' });

    store.getState().acceptPlacement();
    expect(names(store)).toEqual(['home', 'placement']);
    expect(store.getState().stack[1]).toMatchObject({ name: 'placement', index: 0 });

    store.getState().advancePlacementWorld();
    expect(names(store)).toEqual(['home', 'placement']); // replace, not push
    expect(store.getState().stack[1]).toMatchObject({ name: 'placement', index: 1 });

    store.getState().finishPlacement();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });
  });

  it('decline gates straight back to Home', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.getState().reset({ name: 'home' }, { name: 'placement-offer' });

    store.getState().declinePlacement();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });
  });

  it('nothing to test (no Basics lesson): back to Home, ungated', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store } = await storeAtHome(services);
    // Empties the main track's lessons out from under the already-loaded journey, so
    // `planPlacement` finds nothing — same edge `acceptPlacement` itself guards defensively.
    store.setState((state) => ({
      journey: state.journey ? { ...state.journey, lessons: [] } : state.journey,
    }));
    store.getState().reset({ name: 'home' }, { name: 'placement-offer' });

    store.getState().acceptPlacement();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });
  });
});

describe('Pick profile', () => {
  it('selecting a profile from the picker resets straight to Home', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const profile = await seedReturningProfile(services, 'Mia');
    const store = createAppStore(services, chessWeb);
    await store.getState().goToPicker();
    expect(names(store)).toEqual(['picker']);
    await store.getState().selectProfileAndHome(profile.id);
    expect(names(store)).toEqual(['home']);
  });
});

describe('Grown-ups', () => {
  it('picker -> password(parent-area) -> parent on success; Done resets to the picker', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await seedReturningProfile(services, 'Mia');
    const store = createAppStore(services, chessWeb);
    await store.getState().goToPicker();

    store.getState().goToPasswordScreen();
    await waitFor(() => {
      expect(names(store)).toEqual(['picker', 'password']);
    });
    expect(store.getState().stack[1]).toMatchObject({ purpose: 'parent-area' });

    await store.getState().goToParentArea();
    expect(names(store)).toEqual(['picker', 'parent']); // replaces password, picker stays below

    await store.getState().goToPicker(); // "Done"
    expect(names(store)).toEqual(['picker']);
  });
});

describe('Home tiles / back to Home', () => {
  it('a tile push lands on top of Home; its back button gates back to Home and clears levelUpSuggestion', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));

    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });

    store.setState({ levelUpSuggestion: { level: 3 } });
    store.getState().goToHome();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });
    expect(store.getState().levelUpSuggestion).toBeNull();
  });

  it('Play and My Den push the same way', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));

    void store.getState().navigate({ name: 'play' });
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });

    store.getState().goToHome();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });

    store.getState().goToDen();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'den']);
    });
  });
});

describe('Lesson from Journey', () => {
  it('opens gated on top of Journey; Close pops back to Journey', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });

    await store.getState().startLesson('fixture');
    expect(names(store)).toEqual(['home', 'journey', 'lesson']);
    expect(store.getState().stack[2]).toMatchObject({ name: 'lesson', lessonId: 'fixture' });

    store.getState().exitLesson();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });
  });

  it('Continue (lesson-complete) pops back to Journey the same way', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });
    await store.getState().startLesson('fixture');

    await store.getState().completeLessonActivity();
    expect(names(store)).toEqual(['home', 'journey']);
  });
});

describe('Today session', () => {
  it('navigates the first activity onto Home, replaces in place, then gates back to Home', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));

    await store.getState().startToday();
    expect(names(store)).toEqual(['home', 'lesson']);
    expect(store.getState().stack[1]).toMatchObject({
      name: 'lesson',
      lessonId: 'fixture',
      today: true,
    });

    // Only one activity in this fixture session: completing it replaces the lesson route with
    // the summary in place — never a deeper stack to unwind.
    await store.getState().completeLessonActivity();
    expect(names(store)).toEqual(['home', 'today-summary']);

    store.getState().finishToday();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });
    expect(store.getState().todayPlan).toBeNull();
  });

  it('leaving mid-activity (Close) abandons the whole session, gated back to Home', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    await store.getState().startToday();

    store.getState().exitLesson();
    await waitFor(() => {
      expect(names(store)).toEqual(['home']);
    });
    expect(store.getState().todayPlan).toBeNull();
  });
});

describe('Mini-game from Play / Journey', () => {
  it('opens gated on top of Play; exit pops back to Play', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson(), [fixtureBoss()]));
    const { store } = await storeAtHome(services);
    void store.getState().navigate({ name: 'play' });
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });

    store.getState().startMiniGame('fixture-boss');
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play', 'minigame']);
    });
    expect(store.getState().stack[2]).toEqual({ name: 'minigame', miniGameId: 'fixture-boss' });

    store.getState().exitMiniGame();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });
  });

  it('opens gated on top of Journey; exit pops back to Journey', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson(), [fixtureBoss()]));
    const { store } = await storeAtHome(services);
    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });

    store.getState().startMiniGame('fixture-boss');
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey', 'minigame']);
    });

    store.getState().exitMiniGame();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });
  });
});

describe('Full game / vs Friend', () => {
  it('full game opens gated on Play; exit pops to Play', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    void store.getState().navigate({ name: 'play' });
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });

    store.getState().startFullGame(2);
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play', 'full-game']);
    });
    expect(store.getState().stack[2]).toMatchObject({ name: 'full-game', level: 2 });

    store.getState().exitFullGame();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });
  });

  it('vs Friend: setup then game, gated; exit skips the setup sheet straight back to Play', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    void store.getState().navigate({ name: 'play' });
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });

    store.getState().goToFriendSetup();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play', 'friend-setup']);
    });

    store.getState().updateFriendSetup({ opponent: { kind: 'guest' }, gameId: 'full' });
    store.getState().startFriendGame();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play', 'friend-setup', 'friend-game']);
    });

    store.getState().exitFriendGame();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });
  });
});

describe('Test-out / Practice', () => {
  it('test-out opens on top of Journey (ungated); exit pops back', async () => {
    const l1 = fixtureLesson({ id: 'l1', order: 1 });
    const l2 = fixtureLesson({ id: 'l2', order: 2, character: 'elephant' });
    const services = createTestServices(
      makeContentSource({ lessons: [l1, l2], catalog: fixtureCatalog }),
    );
    const { store } = await storeAtHome(services);
    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });

    store.getState().startTestOutLesson('l2', 'test');
    expect(names(store)).toEqual(['home', 'journey', 'assessment']);
    expect(store.getState().stack[2]).toMatchObject({
      name: 'assessment',
      scope: { type: 'lesson', lessonId: 'l2' },
    });

    store.getState().exitAssessment();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });
  });

  it('a practice topic run opens gated on top of Practice; exit pops back', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.getState().goToPractice();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'practice']);
    });

    await store.getState().startPracticeTopic('fixture-move');
    expect(names(store)).toEqual(['home', 'practice', 'practice-run']);

    store.getState().exitPracticeRun();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'practice']);
    });
  });
});

describe('Time limit', () => {
  it('a gated push over the limit shows the gate; a correct "more time" password pops both and resumes unchecked', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store, profileId } = await storeAtHome(services);
    await updateProfileSettings(services.deps, profileId, { dailyLimitMinutes: 15 });
    await seedMinutesToday(services, profileId, 15);

    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });

    // `startLesson` is gated: over the limit, it should push `time-limit` instead of `lesson`,
    // remembering the blocked push as `resume`.
    await store.getState().startLesson('fixture');
    expect(names(store)).toEqual(['home', 'journey', 'time-limit']);
    expect(store.getState().stack[2]).toMatchObject({
      name: 'time-limit',
      resume: { op: 'push', route: { name: 'lesson', lessonId: 'fixture' } },
    });

    store.getState().goToPasswordScreen('more-time');
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey', 'time-limit', 'password']);
    });
    expect(store.getState().stack[3]).toMatchObject({ purpose: 'more-time' });

    await store.getState().grantMoreTimeAndResume();
    // Password and time-limit both popped, the blocked push replayed on what was underneath —
    // never re-checked against the gate (still over the limit, but not blocked this time).
    expect(names(store)).toEqual(['home', 'journey', 'lesson']);
    expect(store.getState().stack[2]).toMatchObject({ lessonId: 'fixture' });

    const log = await services.deps.rewards?.getSessionLog(
      profileId,
      localDayString(services.deps.clock.now()),
    );
    expect(log?.extraMinutes).toBe(15);
  });

  it('Switch player resets to the picker and clears the Today plan', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store, profileId } = await storeAtHome(services);
    await updateProfileSettings(services.deps, profileId, { dailyLimitMinutes: 15 });

    await store.getState().startToday(); // under the limit so far: opens the lesson normally
    await seedMinutesToday(services, profileId, 15); // now over it, for the *next* activity

    store.getState().exitLesson(); // "leaveToday"'s own gate now finds the profile over the limit
    await waitFor(() => {
      expect(store.getState().screen).toBe('time-limit');
    });

    void store.getState().switchPlayerFromTimeLimit();
    await waitFor(() => {
      expect(names(store)).toEqual(['picker']);
    });
    expect(store.getState().todayPlan).toBeNull();
  });
});

describe('Password "Back"', () => {
  it('resets to the picker regardless of what is underneath, discarding a time-limit gate', async () => {
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    const { store, profileId } = await storeAtHome(services);
    await updateProfileSettings(services.deps, profileId, { dailyLimitMinutes: 15 });
    await seedMinutesToday(services, profileId, 15);

    store.getState().goToJourney();
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey']);
    });
    await store.getState().startLesson('fixture');
    store.getState().goToPasswordScreen('more-time');
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'journey', 'time-limit', 'password']);
    });

    // The password screen's own "Back" button always calls `goToPicker` — never a plain `back()`.
    await store.getState().goToPicker();
    expect(names(store)).toEqual(['picker']);
  });
});

describe('ROUTE_ENTER effects', () => {
  it('entering a lesson sets stepIndex to its own startStep', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.setState({ stepIndex: 7 });
    await store.getState().startLesson('fixture');
    expect(store.getState().stepIndex).toBe(0);
  });

  it('entering full-game clears a stale levelUpSuggestion', async () => {
    const { store } = await storeAtHome(createTestServices(fixtureContentSource(fixtureLesson())));
    store.setState({ levelUpSuggestion: { level: 4 } });
    void store.getState().navigate({ name: 'play' });
    await waitFor(() => {
      expect(names(store)).toEqual(['home', 'play']);
    });
    store.getState().startFullGame(1);
    await waitFor(() => {
      expect(store.getState().screen).toBe('full-game');
    });
    expect(store.getState().levelUpSuggestion).toBeNull();
  });
});
