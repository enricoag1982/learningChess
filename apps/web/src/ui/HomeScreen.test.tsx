import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getLessonProgress, nextLesson, withResumeStep } from '@chess-kids/core';
import i18n from '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { tContent } from '../content-text.ts';
import { createTestServices } from '../testing/test-services.ts';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';

afterEach(cleanup);

/** The real (bundled) content, with test adapters otherwise (fake password writer). */
function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

describe('HomeScreen', () => {
  it('new lesson, Owl-taught (no piece character yet): Owl greets by lesson topic, primary button says Start today', async () => {
    // Fixture, not the bundled content: this greeting variant must hold for any Owl-taught
    // lesson, whichever one the real content currently puts first (see character-meta.ts).
    const lesson = fixtureLesson({ character: 'owl', titleKey: 'lessons:squares.title' });
    const services = createTestServices(fixtureContentSource(lesson));
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    const topic = tContent(i18n.t, lesson.titleKey);
    await screen.findByText(i18n.t('home.owl-next-topic', { topic }));
    expect(screen.getByRole('button', { name: /Start today/ })).toBeTruthy();
    // Rank pill shows the starting rank.
    expect(screen.getByText('Pawn rank')).toBeTruthy();
  });

  it('new lesson, piece lesson: Owl greets by character, primary button says Start today', async () => {
    const lesson = fixtureLesson({ character: 'rhino' });
    const services = createTestServices(fixtureContentSource(lesson));
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    const character = i18n.t('characters:rhino.name');
    await screen.findByText(i18n.t('home.owl-next', { character }));
    expect(screen.getByRole('button', { name: /Start today/ })).toBeTruthy();
    expect(screen.getByText('Pawn rank')).toBeTruthy();
  });

  it('in-progress lesson: Owl invites to keep going, primary button says Continue', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    // Whichever lesson the Journey currently offers first (see `journey.spec.ts`), not a
    // hardcoded id: content order changes as worlds are added.
    const catalog = services.deps.content.catalog?.();
    if (!catalog) throw new Error('bundled content: contentSource.catalog() is missing');
    const firstLesson = nextLesson(catalog, services.deps.content.lessons(), []);
    if (!firstLesson) throw new Error('bundled content: no first lesson found');
    const saved = await getLessonProgress(services.deps, profile.id, firstLesson.id);
    await services.deps.progress.saveLesson(withResumeStep(saved, 2, services.deps.clock.now()));

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText("Let's keep going!");
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
  });

  it('every lesson done: Owl says so, no primary button', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    for (const lesson of services.deps.content.lessons()) {
      const saved = await getLessonProgress(services.deps, profile.id, lesson.id);
      const bestStars = Object.fromEntries(
        lesson.exercises.map((exercise) => [exercise.id, 3 as const]),
      );
      await services.deps.progress.saveLesson({ ...saved, bestStars });
    }

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText('You finished everything for now. Come back soon for more!');
    expect(screen.queryByRole('button', { name: /Start today/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue/ })).toBeNull();
  });

  it('switch-player button returns to the picker', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Switch player' }));

    await screen.findByRole('heading', { name: "Who's playing today?" });
  });

  it('Journey tile opens the Journey screen', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));

    await screen.findByRole('button', { name: /Back to Home/ });
  });

  it('Play tile opens the Play screen', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));

    await screen.findByRole('heading', { name: 'Play' });
  });

  it("My Den tile opens Mia's Den", async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));

    await screen.findByText("Mia's Den");
  });
});
