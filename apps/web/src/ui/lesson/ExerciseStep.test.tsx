import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ExerciseDef, SelectSquaresDef } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import '../../i18n.ts';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../../testing/fixtures.ts';
import { renderWithStore } from '../../testing/render-with-store.tsx';
import { createTestServices } from '../../testing/test-services.ts';
import { ExerciseStep } from './ExerciseStep.tsx';

afterEach(cleanup);

describe('ExerciseStep', () => {
  it('solves a collect-stars exercise (tap piece, tap star) and saves 3 stars', async () => {
    const exercise = fixtureExercise('solve-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    await screen.findByText('Amazing!');
    const profile = store.getState().profile;
    expect(profile).not.toBeNull();
    const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
    expect(saved?.bestStars[exercise.id]).toBe(3);
  });

  it('an illegal move counts an error and explains, without moving the piece', async () => {
    const exercise = fixtureExercise('illegal-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^b2,/ })); // diagonal: illegal for a rook

    await screen.findByText('Rhino only runs in straight lines!');
    expect(screen.getByRole('button', { name: /^a1, white rook/ })).toBeTruthy();
  });

  it('a tap with nothing selected asks the kid to tap the piece first (not an error)', async () => {
    const exercise = fixtureExercise('tap-first-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    fireEvent.click(screen.getByRole('button', { name: /^d4,/ })); // empty, nothing selected yet

    await screen.findByText('Tap Rhino first.');
  });

  it('walks the hint ladder from piece to target to the move', async () => {
    const exercise = fixtureExercise('hint-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    const hintButton = screen.getByRole('button', { name: /Hint/ });
    fireEvent.click(hintButton);
    await screen.findByText('Look at Rhino.');
    fireEvent.click(hintButton);
    await screen.findByText('Try the orange square.');
    fireEvent.click(hintButton);
    await screen.findByText('Here is the answer.');
  });

  it('undo takes back the last move', async () => {
    const exercise: ExerciseDef = {
      id: 'undo-me',
      concept: 'fixture-move',
      textKey: 'fixtures:undo',
      position: parseDiagram(`
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . *
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        R . . . . . . .
      `),
      type: 'collect-stars',
      stars3: 1,
      stars2: 2,
    };
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^a5,/ })); // a move, not the star (h5)
    await screen.findByRole('button', { name: /^a5, white rook/ });

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    await screen.findByRole('button', { name: /^a1, white rook/ });
  });

  it('a guided try shows praise and Next only on success, never a stars row', async () => {
    const exercise = fixtureExercise('guided-me');
    const lesson = fixtureLesson({ guided: [exercise], exercises: [] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided nextStepIndex={1} />,
      services,
    );

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    // Guided tries auto-show hint level 1 on mount, so this solves at less than 3 stars — the
    // exact praise line isn't the point here, only that no stars row appears (fix #4).
    await screen.findByRole('button', { name: /^Next/ });
    expect(screen.queryByTestId('stars-row')).toBeNull();
  });

  it('keeps the instruction visible under a hint note, and replay speaks both', async () => {
    const exercise: ExerciseDef = {
      id: 'note-me',
      concept: 'fixture-move',
      textKey: 'fixtures:note-instruction',
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
      type: 'collect-stars',
      stars3: 1,
      stars2: 2,
    };
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    // The instruction (the exercise's textKey, un-translated in this fixture setup) stays on
    // screen even once a hint note appears under it.
    await screen.findByText('note-instruction');
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }));
    await screen.findByText('Look at Rhino.');
    expect(screen.getByText('note-instruction')).toBeTruthy();
  });

  it('select-squares: a wrong pick shows the orange-squares message; the right set solves it', async () => {
    const position = parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . R . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
    `);
    const exercise: SelectSquaresDef = {
      id: 'select-me',
      concept: 'fixture-move',
      textKey: 'fixtures:select',
      position,
      type: 'select-squares',
      answer: { derive: 'legal-moves', from: 'd4' },
    };
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    const answer = services.rules
      .legalMoves(position, { staticOpponent: true }, 'd4')
      .map((move) => move.to);

    fireEvent.click(screen.getByRole('button', { name: /^e5,/ })); // not a legal rook move: wrong
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    await screen.findByText('Not quite! Look at the orange squares.');
    const wrongSquareButton = screen.getByRole('button', { name: /^e5,/ });
    expect(wrongSquareButton.querySelector('.border-today')).not.toBeNull();

    fireEvent.click(wrongSquareButton); // deselect the wrong pick
    for (const square of answer) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${square},`) }));
    }
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));

    // One earlier wrong submission caps this solve at 2 stars (engine.ts `selectSquaresStars`).
    await screen.findByText('Well done!');
    const profile = store.getState().profile;
    const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
    expect(saved?.bestStars[exercise.id]).toBe(2);
  });
});
