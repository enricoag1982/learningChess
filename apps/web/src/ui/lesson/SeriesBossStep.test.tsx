import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { MiniGame, SelectSquaresDef } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import '../../i18n.ts';
import { fixtureContentSource, fixtureLesson } from '../../testing/fixtures.ts';
import type { FakeNarrator } from '../../testing/fake-narrator.ts';
import { renderWithStore } from '../../testing/render-with-store.tsx';
import { createTestServices } from '../../testing/test-services.ts';
import { BossStep } from './BossStep.tsx';

const EMPTY_POSITION = parseDiagram(
  [
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
  ].join('\n'),
);

function round(id: string, answer: readonly ('a1' | 'h8')[]): SelectSquaresDef {
  return {
    id,
    concept: 'board-squares',
    textKey: `fixtures:${id}`,
    position: EMPTY_POSITION,
    type: 'select-squares',
    answer: { squares: answer },
  };
}

function fixtureSeriesBoss(errors3: number, errors2: number): MiniGame {
  return {
    mode: 'series',
    id: 'fixture-square-hunt',
    concept: 'board-squares',
    rounds: [round('sh-r1', ['a1']), round('sh-r2', ['h8'])],
    errors3,
    errors2,
    titleKey: 'fixtures:boss-title',
    goalKey: 'fixtures:boss-goal',
    unlockAfter: 'fixture',
  };
}

afterEach(cleanup);

describe('SeriesBossStep (via BossStep dispatching on mode)', () => {
  it('happy path: solves every round with no mistakes for 3 stars, showing a round counter throughout', async () => {
    const boss = fixtureSeriesBoss(0, 2);
    const lesson = fixtureLesson({ boss: boss.id });
    const services = createTestServices(fixtureContentSource(lesson, [boss]));
    const { store } = await renderWithStore(
      <BossStep lesson={lesson} game={boss} nextStepIndex={5} />,
      services,
    );

    expect(screen.getByText('Round 1 of 2')).toBeTruthy();
    expect(screen.getByText('0 mistakes so far')).toBeTruthy();

    // Round 1: tap the correct square, check, then Next to round 2.
    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    expect(screen.getByText('Round 2 of 2')).toBeTruthy();
    expect(screen.getByText('0 mistakes so far')).toBeTruthy();

    // Round 2: solve it too; the series should now be done.
    fireEvent.click(screen.getByRole('button', { name: /^h8,/ }));
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    expect(screen.getByTestId('stars-row')).toBeTruthy();

    const profile = store.getState().profile;
    await waitFor(async () => {
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bossStars).toBe(3);
    });
  });

  it('a wrong try in a round counts as a mistake, lowering the final stars', async () => {
    const boss = fixtureSeriesBoss(0, 2);
    const lesson = fixtureLesson({ boss: boss.id });
    const services = createTestServices(fixtureContentSource(lesson, [boss]));
    const narrator = services.narrator as unknown as FakeNarrator;
    const { store } = await renderWithStore(
      <BossStep lesson={lesson} game={boss} nextStepIndex={5} />,
      services,
    );

    // Round 1: solve cleanly (0 mistakes so far).
    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    // Round 2: a wrong try first (h8 is the answer; tap a1 by mistake and check).
    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    expect(screen.getByText('1 mistake so far')).toBeTruthy();
    // The instruction, then the wrong-pick note, as two separate utterances (M6.3 item 1) — not
    // one `${instruction} ${note}` concatenation.
    await waitFor(() => {
      expect(narrator.spoken.slice(-2)).toEqual([
        'sh-r2',
        'Not quite! Take away the orange squares and tap the dashed ones.',
      ]);
    });

    // Deselect the wrong pick, select the right one, and finish.
    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h8,/ }));
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    // 1 total mistake: above errors3 (0), at/under errors2 (2) -> 2 stars.
    const profile = store.getState().profile;
    await waitFor(async () => {
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bossStars).toBe(2);
    });
  });
});
