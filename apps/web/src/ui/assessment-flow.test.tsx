import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ContentSource,
  Lesson,
  Track,
  TracksCatalog,
  World,
  YesNoDef,
} from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { fixtureExercise, fixtureLesson } from '../testing/fixtures.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';
import { createTestServices } from '../testing/test-services.ts';

afterEach(cleanup);

// Two worlds, three lessons: w1 (no boss) = l1 (Rhino, collect-stars) -> l2 (Elephant, yes-no);
// w2 (no boss) = l3 (Lioness, yes-no). Distinct characters keep every Journey node's accessible
// name unambiguous ("<Character> the <piece>, <status>"); yes-no's Yes/No buttons are the most
// reliable way to force a deliberately-wrong first try in these tests (M4.5's own "Fail" runs).
const L1_EXERCISE = fixtureExercise('l1-ex');
const YES_NO_POSITION = parseDiagram(`
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . R . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
`);
const L2_EXERCISE: YesNoDef = {
  id: 'l2-ex',
  concept: 'l2-concept',
  textKey: 'fixtures:l2-ex',
  position: YES_NO_POSITION,
  type: 'yes-no',
  answer: true,
  focus: 'e4',
};
const L3_EXERCISE: YesNoDef = {
  id: 'l3-ex',
  concept: 'l3-concept',
  textKey: 'fixtures:l3-ex',
  position: YES_NO_POSITION,
  type: 'yes-no',
  answer: true,
  focus: 'e4',
};

function buildFixture(): {
  readonly contentSource: ContentSource;
  readonly l1: Lesson;
  readonly l2: Lesson;
  readonly l3: Lesson;
} {
  const l1 = fixtureLesson({
    id: 'l1',
    world: 'w1',
    order: 1,
    character: 'rhino',
    concept: 'l1-concept',
    exercises: [L1_EXERCISE],
  });
  const l2 = fixtureLesson({
    id: 'l2',
    world: 'w1',
    order: 2,
    character: 'elephant',
    concept: 'l2-concept',
    exercises: [L2_EXERCISE],
  });
  const l3 = fixtureLesson({
    id: 'l3',
    world: 'w2',
    order: 1,
    character: 'lioness',
    concept: 'l3-concept',
    exercises: [L3_EXERCISE],
  });
  const w1: World = {
    id: 'w1',
    track: 'test',
    order: 1,
    habitat: 'meadow',
    titleKey: 'fixtures:w1',
  };
  const w2: World = {
    id: 'w2',
    track: 'test',
    order: 2,
    habitat: 'savannah',
    titleKey: 'fixtures:w2',
  };
  const track: Track = { id: 'test', kind: 'main', titleKey: 'fixtures:track', worlds: [w1, w2] };
  const catalog: TracksCatalog = { tracks: [track], ranks: [{ id: 'pawn', after: 'start' }] };
  const lessons = [l1, l2, l3];
  const contentSource: ContentSource = {
    lessons: () => lessons,
    lesson: (id) => lessons.find((entry) => entry.id === id),
    minigames: () => [],
    minigame: () => undefined,
    catalog: () => catalog,
    badges: () => [],
  };
  return { contentSource, l1, l2, l3 };
}

/** Solves the shown collect-stars fixture exercise (tap the rook at a1, then the star at h1). */
function solveCollectStars(): void {
  fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
  fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));
}

describe('Test-out (M4.5)', () => {
  it('locked lesson -> sheet -> runner (no hint button) -> pass -> lesson unlocked', async () => {
    const { contentSource, l1, l2 } = buildFixture();
    const services = createTestServices(contentSource);
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Elephant the Bishop, locked/ }));

    // Locked-lesson message bar's "Show you know it?" button opens the sheet.
    fireEvent.click(await screen.findByRole('button', { name: 'Show you know it' }));
    const sheet = await screen.findByRole('dialog');
    within(sheet).getByText(/Want to show me you already know Elephant\?/);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes, test me!' }));

    // The runner: one task (this lesson has one scored exercise), no Hint button.
    await screen.findByText('Task 1/1');
    expect(screen.queryByRole('button', { name: /Hint/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));
    await screen.findByText('You did it!');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Back on the Journey (not Home): the lesson is no longer locked.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /locked/ })).toBeNull();
    });

    const progress = await services.deps.progress.getLesson(profile.id, l2.id);
    expect(progress?.masteredVia).toBe('test-out');
    expect(progress?.bestStars).toEqual({ 'l2-ex': 1 });

    // Never lowers l1's own progress, untouched by this run.
    const l1Progress = await services.deps.progress.getLesson(profile.id, l1.id);
    expect(l1Progress).toBeUndefined();
  });

  it('a wrong first try fails the run: no penalty, lesson stays locked', async () => {
    const { contentSource, l2 } = buildFixture();
    const services = createTestServices(contentSource);
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Elephant the Bishop, locked/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show you know it' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, test me!' }));

    await screen.findByText('Task 1/1');
    fireEvent.click(screen.getByRole('button', { name: 'No' })); // wrong first try
    await screen.findByText('Not quite! Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Yes' })); // now solved
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    await screen.findByText('Keep going!');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('button', { name: /Elephant the Bishop, locked/ });
    const progress = await services.deps.progress.getLesson(profile.id, l2.id);
    expect(progress).toBeUndefined(); // nothing lost, nothing saved
  });

  it('locked world -> sheet -> runner -> pass -> world available, its lesson mastered', async () => {
    const { contentSource, l3 } = buildFixture();
    const services = createTestServices(contentSource);
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));
    fireEvent.click(await screen.findByRole('button', { name: /2.*w2/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show you know it' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, test me!' }));

    await screen.findByText('Task 1/1');
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    await screen.findByText('You did it!');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Back on the Journey (defaults to World 1's map again — it still has an available lesson):
    // reselect World 2, whose lesson is now reachable, no longer behind the "locked world" banner.
    fireEvent.click(await screen.findByRole('button', { name: /2.*w2/ }));
    await screen.findByRole('button', { name: /Lioness the Queen/ });
    const progress = await services.deps.progress.getLesson(profile.id, l3.id);
    expect(progress?.masteredVia).toBe('test-out');
  });
});

/** Full onboarding (welcome -> password -> new player), stopping right at the placement offer. */
async function completeOnboardingToPlacementOffer(nickname: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Start setup' }));
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: '1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
  await screen.findByText('Password saved!');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(await screen.findByPlaceholderText('Your name'), {
    target: { value: nickname },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Pick your animal!');
  fireEvent.click(screen.getByRole('button', { name: "Let's play!" }));
  await screen.findByText("Already know some chess? Let's find out where to start you!");
}

describe('Placement (M4.5)', () => {
  it('offered once after creating a new player; declining goes straight to Home', async () => {
    const { contentSource } = buildFixture();
    const services = createTestServices(contentSource);
    render(<App services={services} />);

    await completeOnboardingToPlacementOffer('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'No, start at World 1' }));

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
  });

  it('passes World 1, fails World 2 (no penalty), summary, Home; Journey reflects it', async () => {
    const { contentSource, l1, l3 } = buildFixture();
    const services = createTestServices(contentSource);
    render(<App services={services} />);

    await completeOnboardingToPlacementOffer('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, test me!' }));

    // World 1's pool (l1's collect-stars, l2's yes-no) has 2 exercises: sampled down to 2 tasks
    // (min(4, pool)), needing both right (ceil(0.75*2)=2) to pass. Every board always renders an
    // "a1" square regardless of exercise type, so the task's own instruction text (the raw
    // untranslated `textKey`, same as the real e2e helpers' "whichever is showing" pattern) is what
    // tells `l1-ex`/`l2-ex` apart, not the board.
    await screen.findByText(/World 1 · Task 1\/2/);
    for (let i = 0; i < 2; i += 1) {
      if (screen.queryByText('l1-ex')) {
        solveCollectStars();
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
      }
      fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));
    }

    // World 2's pool (l3 only) has 1 exercise: 1 task, answered wrong then solved -> fails.
    await screen.findByText(/World 2 · Task 1\/1/);
    fireEvent.click(screen.getByRole('button', { name: 'No' })); // wrong first try
    await screen.findByText('Not quite! Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Yes' })); // now solved
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    await screen.findByText('Great job!');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });

    const l1Progress = await services.deps.progress.getLesson(
      (await services.deps.profiles.list())[0]?.id ?? '',
      l1.id,
    );
    expect(l1Progress?.masteredVia).toBe('placement');
    const l3Progress = await services.deps.progress.getLesson(
      (await services.deps.profiles.list())[0]?.id ?? '',
      l3.id,
    );
    expect(l3Progress).toBeUndefined(); // World 2 failed: nothing lost, nothing saved

    // World 2 is now available (World 1 mastered): the locked-world banner is gone.
    fireEvent.click(screen.getByRole('button', { name: /Journey/ }));
    fireEvent.click(await screen.findByRole('button', { name: /2.*w2/ }));
    expect(screen.queryByText('Finish the earlier worlds first to unlock this one.')).toBeNull();
    await screen.findByRole('button', { name: /Lioness the Queen/ });
  });

  it('closing mid-run ("Leave") skips the rest, keeping what already passed', async () => {
    const { contentSource, l1 } = buildFixture();
    const services = createTestServices(contentSource);
    render(<App services={services} />);

    await completeOnboardingToPlacementOffer('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, test me!' }));

    await screen.findByText(/World 1 · Task 1\/2/);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' })); // closes before any task is done

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
    const profileId = (await services.deps.profiles.list())[0]?.id ?? '';
    const l1Progress = await services.deps.progress.getLesson(profileId, l1.id);
    expect(l1Progress).toBeUndefined(); // nothing was completed, nothing applied
  });
});

describe('Parent unlock (M4.5)', () => {
  it('unlocks a locked lesson directly from the parent area', async () => {
    const { contentSource, l2 } = buildFixture();
    const services = createTestServices(contentSource);
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);

    fireEvent.click(await screen.findByRole('button', { name: /Grown-ups/ }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('heading', { name: 'Parent area' });

    // M5.1: the unlock panel moved from the overview row into the child's own Settings screen.
    const miaCard = (await screen.findByText('Mia')).closest('button');
    if (!miaCard) throw new Error('Mia card not found');
    fireEvent.click(miaCard);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    // l1 is unlocked by default (world's first lesson); l2 is locked and listed with its own toggle.
    const l2Row = (await screen.findByText(/Elephant/)).closest('div');
    if (!l2Row) throw new Error('Elephant row not found');
    fireEvent.click(within(l2Row).getByRole('button', { name: 'Unlock' }));

    await waitFor(async () => {
      const progress = await services.deps.progress.getLesson(profile.id, l2.id);
      expect(progress?.masteredVia).toBe('parent');
    });
    // No star floor for a parent unlock (domain-model.md §3.2): admin override, not a passed check.
    const progress = await services.deps.progress.getLesson(profile.id, l2.id);
    expect(progress?.bestStars ?? {}).toEqual({});

    // Back to Mia's own session: the Journey now shows it unlocked.
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // settings -> report
    fireEvent.click(await screen.findByRole('button', { name: 'Back' })); // report -> overview
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    // Waits for the picker itself (not just any "Mia" match — the overview's own child card is
    // also named "Mia" and can still be mounted the instant after the async `goToPicker()` fires).
    await screen.findByRole('heading', { name: "Who's playing today?" });
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));
    expect(screen.queryByRole('button', { name: /Elephant the Bishop, locked/ })).toBeNull();
  });

  it('unlocks a whole locked world directly from the parent area', async () => {
    const { contentSource, l3 } = buildFixture();
    const services = createTestServices(contentSource);
    const profile = await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);

    fireEvent.click(await screen.findByRole('button', { name: /Grown-ups/ }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('heading', { name: 'Parent area' });

    // M5.1: the unlock panel moved from the overview row into the child's own Settings screen.
    const miaCard = screen.getByText('Mia').closest('button');
    if (!miaCard) throw new Error('Mia card not found');
    fireEvent.click(miaCard);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    await screen.findByRole('button', { name: 'Unlock world' });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock world' }));

    await waitFor(async () => {
      const progress = await services.deps.progress.getLesson(profile.id, l3.id);
      expect(progress?.masteredVia).toBe('parent');
    });
  });
});
