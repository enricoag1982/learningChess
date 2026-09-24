import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { MiniGame } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import '../../i18n.ts';
import { fixtureContentSource, fixtureLesson } from '../../testing/fixtures.ts';
import { renderWithStore } from '../../testing/render-with-store.tsx';
import { createTestServices } from '../../testing/test-services.ts';
import { BossStep } from './BossStep.tsx';

function fixtureBoss(): MiniGame {
  return {
    mode: 'static',
    id: 'fixture-boss',
    concept: 'fixture-move',
    position: parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . p
    `),
    par: 1,
    moveLimit: 5,
    titleKey: 'fixtures:boss-title',
    goalKey: 'fixtures:boss-goal',
    unlockAfter: 'fixture',
  };
}

afterEach(cleanup);

describe('BossStep', () => {
  it('winning within par earns 3 stars, saved as the boss result', async () => {
    const boss = fixtureBoss();
    const lesson = fixtureLesson({ boss: boss.id });
    const services = createTestServices(fixtureContentSource(lesson, [boss]));
    const { store } = await renderWithStore(
      <BossStep lesson={lesson} game={boss} nextStepIndex={5} />,
      services,
    );

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    await screen.findByRole('button', { name: /Next/ });
    const profile = store.getState().profile;
    await waitFor(async () => {
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bossStars).toBe(3);
    });
  });

  it('a collect-stars goal shows a stars counter and wins by collecting every star', async () => {
    const boss: MiniGame = {
      mode: 'static',
      id: 'fixture-boss-stars',
      concept: 'fixture-move',
      position: parseDiagram(`
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        R . . . . . . *
      `),
      goal: 'collect-stars',
      par: 1,
      moveLimit: 5,
      titleKey: 'fixtures:boss-title',
      goalKey: 'fixtures:boss-goal',
      unlockAfter: 'fixture',
    };
    const lesson = fixtureLesson({ boss: boss.id });
    const services = createTestServices(fixtureContentSource(lesson, [boss]));
    await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

    expect(screen.getByText('Stars 0 of 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    await screen.findByRole('button', { name: /Next/ });
    expect(screen.getByText('Stars 1 of 1')).toBeTruthy();
  });
});
