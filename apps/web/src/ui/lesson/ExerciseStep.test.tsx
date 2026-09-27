import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type {
  BestMoveDef,
  ChoiceDef,
  ExerciseDef,
  MateInNDef,
  Position,
  SelectSquaresDef,
  SetupDef,
  YesNoDef,
} from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import '../../i18n.ts';
import {
  fixtureContentSource,
  fixtureExercise,
  fixtureLesson,
  fixtureVariantExercise,
} from '../../testing/fixtures.ts';
import type { FakeNarrator } from '../../testing/fake-narrator.ts';
import { stubMatchMedia } from '../../testing/mock-media-query.ts';
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

  it('hides the Hint button when the profile\'s "hints" setting is off (M5.1)', async () => {
    const exercise = fixtureExercise('hint-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    expect(screen.getByRole('button', { name: 'Hint' })).toBeTruthy();

    act(() => {
      store.setState({
        activeProfileSettings: { ...store.getState().activeProfileSettings, hints: false },
      });
    });

    expect(screen.queryByRole('button', { name: 'Hint' })).toBeNull();
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

  it('keeps the instruction visible under a hint note, and narrates each as its own utterance (M6.3 item 1)', async () => {
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
    const narrator = services.narrator as unknown as FakeNarrator;
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
    );

    // The instruction (the exercise's textKey, un-translated in this fixture setup) stays on
    // screen even once a hint note appears under it.
    await screen.findByText('note-instruction');
    expect(narrator.spoken).toEqual(['note-instruction']); // no note yet: nothing to append

    fireEvent.click(screen.getByRole('button', { name: /Hint/ }));
    await screen.findByText('Look at Rhino.');
    expect(screen.getByText('note-instruction')).toBeTruthy();
    // The note alone, not the whole instruction re-read (owner report 2026-09-26).
    expect(narrator.spoken).toEqual(['note-instruction', 'Look at Rhino.']);

    // A second hint note is appended alone too — the instruction is still not repeated.
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }));
    await screen.findByText('Try the orange square.');
    expect(narrator.spoken).toEqual([
      'note-instruction',
      'Look at Rhino.',
      'Try the orange square.',
    ]);

    // Replay speaks the instruction + current note again, from the top.
    const spokenBeforeReplay = narrator.spoken.length;
    fireEvent.click(screen.getByRole('button', { name: /Say it again/ }));
    await waitFor(() => {
      expect(narrator.spoken.slice(spokenBeforeReplay)).toEqual([
        'note-instruction',
        'Try the orange square.',
      ]);
    });
  });

  it('select-squares: a wrong check marks wrong picks and missing squares; the right set solves it', async () => {
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
    await screen.findByText('Not quite! Take away the orange squares and tap the dashed ones.');
    const wrongSquareButton = screen.getByRole('button', {
      name: /^e5, empty, selected, not right/,
    });
    expect(wrongSquareButton.querySelector('.border-today')).not.toBeNull();
    // Every answer square not picked is marked "still missing" (dashed orange) after the check.
    for (const square of answer) {
      const missedButton = screen.getByRole('button', {
        name: new RegExp(`^${square}, empty, still missing$`),
      });
      expect(missedButton.querySelector('.border-dashed.border-today')).not.toBeNull();
    }

    fireEvent.click(wrongSquareButton); // deselect the wrong pick
    expect(screen.getByRole('button', { name: /^e5, empty$/ })).toBeTruthy(); // marker gone
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

  describe('yes-no', () => {
    const position = parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . R . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
    `);
    const exercise: YesNoDef = {
      id: 'yn-me',
      concept: 'fixture-move',
      textKey: 'fixtures:yn',
      position,
      type: 'yes-no',
      answer: true,
      focus: 'e4',
    };

    it('a wrong answer explains and can be retried; the right one solves it', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      await screen.findByText('Not quite! Try again.');

      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
      await screen.findByText('Well done!'); // one earlier wrong answer caps this at 2 stars

      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars[exercise.id]).toBe(2);
    });

    it('hint ladder: look closely, then think again, then reveal', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      const hintButton = screen.getByRole('button', { name: /Hint/ });
      fireEvent.click(hintButton);
      await screen.findByText('Look closely.');
      fireEvent.click(hintButton);
      await screen.findByText('Think about it again.');
      fireEvent.click(hintButton);
      await screen.findByText('Here is the answer.');
    });
  });

  describe('choice', () => {
    const position = parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
    `);
    const exercise: ChoiceDef = {
      id: 'ch-me',
      concept: 'fixture-move',
      textKey: 'fixtures:ch',
      position,
      type: 'choice',
      showBoard: false,
      options: [
        { id: 'queen', textKey: 'fixtures:opt-queen' },
        { id: 'rook', textKey: 'fixtures:opt-rook' },
        { id: 'bishop', textKey: 'fixtures:opt-bishop' },
      ],
      answer: 'queen',
    };

    it('a wrong pick disables it and explains; the right one solves it', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      fireEvent.click(screen.getByRole('button', { name: 'opt-rook' }));
      await screen.findByText('Not quite! Try again.');
      expect(screen.getByRole('button', { name: 'opt-rook' }).hasAttribute('disabled')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'opt-queen' }));
      await screen.findByText('Well done!'); // one earlier wrong pick caps this at 2 stars

      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars[exercise.id]).toBe(2);
    });

    it('hint ladder removes one wrong option per level, then reveals', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      const hintButton = screen.getByRole('button', { name: /Hint/ });
      fireEvent.click(hintButton);
      await screen.findByText('One choice is ruled out.');
      const disabledAfterFirst = [
        screen.getByRole('button', { name: 'opt-rook' }).hasAttribute('disabled'),
        screen.getByRole('button', { name: 'opt-bishop' }).hasAttribute('disabled'),
      ].filter(Boolean).length;
      expect(disabledAfterFirst).toBe(1);

      fireEvent.click(hintButton);
      expect(screen.getByRole('button', { name: 'opt-rook' }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'opt-bishop' }).hasAttribute('disabled')).toBe(
        true,
      );

      fireEvent.click(hintButton);
      await screen.findByText('Here is the answer.');
    });
  });

  describe('best-move', () => {
    const position = parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
    `);
    const exercise: BestMoveDef = {
      id: 'bm-me',
      concept: 'fixture-move',
      textKey: 'fixtures:bm',
      position,
      type: 'best-move',
      solutions: ['Ra8'],
    };

    it('a legal but wrong move explains and leaves the piece in place; the solution solves it', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^h1,/ })); // legal, not the solution
      await screen.findByText('Not this one. Try again!');
      expect(screen.getByRole('button', { name: /^a1, white rook/ })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a8,/ })); // the listed solution
      await screen.findByText('Well done!'); // one earlier wrong attempt caps this at 2 stars

      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars[exercise.id]).toBe(2);
    });

    it('hint ladder from piece to target to the move', async () => {
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

    it("shows the opponent's lastMove highlight from the start (M4.1, before any move is played)", async () => {
      const withLastMove: BestMoveDef = { ...exercise, lastMove: { from: 'h1', to: 'a1' } };
      const lesson = fixtureLesson({ exercises: [withLastMove] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={withLastMove} guided={false} nextStepIndex={3} />,
        services,
      );

      const a1 = screen.getByRole('button', { name: /^a1,/ });
      expect(a1.querySelector('[class*="F4D35E"]')).not.toBeNull();
    });
  });

  describe('setup', () => {
    const emptyPosition: Position = {
      pieces: {},
      markers: { stars: [], blocked: [] },
      toMove: 'w',
      castling: '-',
      enPassant: null,
    };
    const target = parseDiagram(`
      . . . . . . . r
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
    `);
    const exercise: SetupDef = {
      id: 'su-me',
      concept: 'board-setup',
      textKey: 'fixtures:su',
      position: emptyPosition,
      type: 'setup',
      target,
    };

    it('places from the palette; a wrong square explains; solves once complete', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      fireEvent.click(screen.getByRole('button', { name: /black rook, \d+ left/ }));
      fireEvent.click(screen.getByRole('button', { name: /^h8,/ }));
      await screen.findByRole('button', { name: /^h8, black rook/ });

      fireEvent.click(screen.getByRole('button', { name: /white rook, \d+ left/ }));
      fireEvent.click(screen.getByRole('button', { name: /^h1,/ })); // wrong square for the white rook
      await screen.findByText('Not quite! Try a different piece or square.');

      fireEvent.click(screen.getByRole('button', { name: /white rook, \d+ left/ })); // reselect
      fireEvent.click(screen.getByRole('button', { name: /^a1,/ })); // correct: solves
      await screen.findByText('Well done!'); // one earlier wrong placement caps this at 2 stars

      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars[exercise.id]).toBe(2);
    });

    it('hint ladder: next piece, then its square, then places it', async () => {
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      const hintButton = screen.getByRole('button', { name: /Hint/ });
      fireEvent.click(hintButton);
      await screen.findByText('Place the black rook next.');
      fireEvent.click(hintButton);
      await screen.findByText('Put it on the orange square.');
      fireEvent.click(hintButton);
      await screen.findByText('Here is the answer.');

      await screen.findByRole('button', { name: /^h8, black rook/ });
    });

    it('on a stacked layout (phone / iPad portrait), the piece tray sits directly under the board, before the Owl bubble (M2.4 §2b)', async () => {
      // jsdom has no `matchMedia` (see useMediaQuery.ts), so `useIsStackedLayout()` defaults to
      // `true` here — the same "no room beside the board" layout as phone and iPad portrait.
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
        services,
      );

      const board = screen.getByLabelText('Chess board');
      const trayTile = screen.getByRole('button', { name: /black rook, \d+ left/ });
      const hintButton = screen.getByRole('button', { name: /Hint/ });

      // Tray comes after the board (directly under it)...
      expect(
        board.compareDocumentPosition(trayTile) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // ...and before the rest of the panel (the Owl bubble, hint/undo controls).
      expect(
        trayTile.compareDocumentPosition(hintButton) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // Only one tray renders (not one hidden copy per layout): exactly one tile per palette piece.
      expect(screen.getAllByRole('button', { name: /black rook, \d+ left/ })).toHaveLength(1);
    });

    it('on a side-by-side layout (tablet landscape, desktop), the tray stays in the side panel', async () => {
      // `useIsStackedLayout()` reads false once `(min-width: 1024px)` matches.
      const restoreMatchMedia = stubMatchMedia('(min-width: 1024px)');

      try {
        const lesson = fixtureLesson({ exercises: [exercise] });
        const services = createTestServices(fixtureContentSource(lesson));
        await renderWithStore(
          <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
          services,
        );

        const hintButton = screen.getByRole('button', { name: /Hint/ });
        const trayTile = screen.getByRole('button', { name: /black rook, \d+ left/ });
        // Now the tray comes after the panel's other controls (its usual side-panel spot), not
        // before them.
        expect(
          hintButton.compareDocumentPosition(trayTile) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(screen.getAllByRole('button', { name: /black rook, \d+ left/ })).toHaveLength(1);
      } finally {
        restoreMatchMedia();
      }
    });
  });

  describe('easier variant offer (teaching-process.md §3.3)', () => {
    // best-move (not collect-stars): its stars depend on errors too, so the "declining" test below
    // can show a real, error-driven star count on the original.
    const originalPosition = parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
    `);
    const original: BestMoveDef = {
      id: 'orig-me',
      concept: 'fixture-move',
      textKey: 'fixtures:orig',
      position: originalPosition,
      type: 'best-move',
      solutions: ['Rh1'],
      easier: 'orig-me-easy',
    };
    const variant = fixtureVariantExercise('orig-me-easy');

    /**
     * `count` illegal a1 → b2 attempts for a rook: tapping a1 selects it, then each `b2` tap is a
     * fresh illegal attempt (the board keeps a1 selected after an illegal try, so it is tapped only
     * once here — re-tapping the already-selected a1 would instead deselect it).
     */
    function makeIllegalMoves(count: number): void {
      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      for (let i = 0; i < count; i += 1) {
        fireEvent.click(screen.getByRole('button', { name: /^b2,/ }));
      }
    }

    it('does not offer the easier variant after only 1 error', async () => {
      const lesson = fixtureLesson({ exercises: [original], variants: [variant] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(1);

      await screen.findByText('Rhino only runs in straight lines!');
      expect(screen.queryByText(/tricky/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Easier one' })).toBeNull();
    });

    it('offers the easier variant once errors reach 2: an extra sentence and a button', async () => {
      const lesson = fixtureLesson({ exercises: [original], variants: [variant] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(2);

      await screen.findByText(
        'Rhino only runs in straight lines! This one is tricky. Want an easier one?',
      );
      expect(screen.getByRole('button', { name: 'Easier one' })).toBeTruthy();
    });

    it('tapping the offer logs the failed original attempt and swaps the board to the variant', async () => {
      const lesson = fixtureLesson({ exercises: [original], variants: [variant] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(2);
      fireEvent.click(await screen.findByRole('button', { name: 'Easier one' }));

      // The variant's own instruction and board (a star at a8, which the original never has).
      await screen.findByText('orig-me-easy');
      expect(screen.getByRole('button', { name: /^a8, star/ })).toBeTruthy();

      const profile = store.getState().profile;
      const attempts = await services.deps.progress.listAttempts(profile?.id ?? '');
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({
        exerciseId: 'orig-me',
        scored: true,
        correct: false,
        errors: 2,
      });
    });

    it('leaving the original for its easier variant puts the concept in review, due now (M3.4)', async () => {
      const lesson = fixtureLesson({ exercises: [original], variants: [variant] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(2);
      fireEvent.click(await screen.findByRole('button', { name: 'Easier one' }));
      await screen.findByRole('button', { name: /^a8, star/ });

      const profile = store.getState().profile;
      const stats = await services.deps.progress.getConceptStats(
        profile?.id ?? '',
        original.concept,
      );
      expect(stats?.box).toBe(1);
      // "Due now": not scheduled into the future (`enterReview`'s `immediate` case), not the
      // 1-day-out default a lesson simply completing would give it.
      expect(stats?.dueAt).toBeDefined();
      expect(new Date(stats?.dueAt ?? 0).getTime()).toBeLessThanOrEqual(Date.now());
      expect(stats?.recent).toEqual([false]);

      // Solving the variant itself must not add a second (unscored) result to `recent`.
      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));
      await screen.findByText('Good try!');
      const afterVariant = await services.deps.progress.getConceptStats(
        profile?.id ?? '',
        original.concept,
      );
      expect(afterVariant?.recent).toEqual([false]);
    });

    it('solving the variant credits the original with 1 star; the variant itself earns none', async () => {
      const lesson = fixtureLesson({ exercises: [original], variants: [variant] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(2);
      fireEvent.click(await screen.findByRole('button', { name: 'Easier one' }));
      await screen.findByRole('button', { name: /^a8, star/ });

      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));

      await screen.findByText('Good try!');
      const starsRow = screen.getByTestId('stars-row');
      const filled = [...starsRow.children].filter(
        (child) => !(child as HTMLElement).className.includes('opacity-25'),
      );
      expect(filled).toHaveLength(1);

      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars['orig-me']).toBe(1);
      expect(saved?.bestStars['orig-me-easy']).toBeUndefined();
    });

    it('a guided try never offers its easier variant, even past 2 errors', async () => {
      const guidedOriginal: BestMoveDef = { ...original, id: 'guided-orig' };
      const lesson = fixtureLesson({
        guided: [guidedOriginal],
        exercises: [],
        variants: [variant],
      });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={guidedOriginal} guided nextStepIndex={1} />,
        services,
      );

      makeIllegalMoves(2);

      expect(screen.queryByRole('button', { name: 'Easier one' })).toBeNull();
    });

    it('a scored exercise with no easier of its own never offers one, even past 2 errors', async () => {
      const noEasier: BestMoveDef = {
        id: 'no-easy-me',
        concept: 'fixture-move',
        textKey: 'fixtures:orig',
        position: originalPosition,
        type: 'best-move',
        solutions: ['Rh1'],
      };
      const lesson = fixtureLesson({ exercises: [noEasier] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={noEasier} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(2);

      expect(screen.queryByRole('button', { name: 'Easier one' })).toBeNull();
    });

    it('declining: the kid can keep trying the original, which still saves its own stars', async () => {
      const lesson = fixtureLesson({ exercises: [original], variants: [variant] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
        services,
      );

      makeIllegalMoves(2);
      await screen.findByRole('button', { name: 'Easier one' }); // offer shown, ignored

      // a1 is still selected (an illegal attempt doesn't deselect it): tap the solution directly.
      fireEvent.click(screen.getByRole('button', { name: /^h1,/ })); // the solution

      // 2 earlier errors cap a best-move solve at 1 star (engine.ts errorHintStars).
      await screen.findByText('Good try!');
      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars['orig-me']).toBe(1);
    });
  });

  describe('mate-in-n', () => {
    // Black king h8 alone; two white rooks (b1, d1) can each independently deliver back-rank mate
    // once Ra7 has cut off the 7th rank — Rb8# and Rd8# are both legal mating moves.
    const mateIn1Position = parseDiagram(`
      . . . . . . . k
      R . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . K .
      . R . R . . . .
    `);
    const mateIn1: MateInNDef = {
      id: 'mate1-me',
      concept: 'mate-in-1',
      textKey: 'fixtures:mate1',
      position: mateIn1Position,
      type: 'mate-in-n',
      n: 1,
      line: ['Rb8#'],
    };

    it('accepts any mating move, not only the scripted one', async () => {
      const lesson = fixtureLesson({ exercises: [mateIn1] });
      const services = createTestServices(fixtureContentSource(lesson));
      const { store } = await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={mateIn1} guided={false} nextStepIndex={3} />,
        services,
      );

      fireEvent.click(screen.getByRole('button', { name: /^d1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^d8,/ })); // Rd8#, not the scripted Rb8#

      await screen.findByText(/Checkmate!/);
      const profile = store.getState().profile;
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bestStars[mateIn1.id]).toBe(3);
    });

    it('a legal-but-wrong move bounces back without changing the position', async () => {
      const lesson = fixtureLesson({ exercises: [mateIn1] });
      const services = createTestServices(fixtureContentSource(lesson));
      await renderWithStore(
        <ExerciseStep lesson={lesson} exercise={mateIn1} guided={false} nextStepIndex={3} />,
        services,
      );

      fireEvent.click(screen.getByRole('button', { name: /^b1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^b2,/ })); // legal, not mate

      await screen.findByText('Not this one. Try again!');
      expect(screen.getByRole('button', { name: /^b1, white rook/ })).toBeTruthy();
    });

    it('shows the scripted opponent reply after a delay, then the kid finishes it', async () => {
      const restoreMatchMedia = stubMatchMedia('(prefers-reduced-motion: reduce)');
      try {
        const position = parseDiagram(`
          . . . . . . k .
          . . . . . p p p
          . . N . . . . .
          . . . . . . . .
          . . . . . . . .
          . . . . . . . .
          . . . . . . . .
          Q K . . . . . .
        `);
        const exercise: MateInNDef = {
          id: 'mate2-me',
          concept: 'mate-in-2',
          textKey: 'fixtures:mate2',
          position,
          type: 'mate-in-n',
          n: 2,
          line: ['Ne7+', 'Kh8', 'Qa8#'],
        };
        const lesson = fixtureLesson({ exercises: [exercise] });
        const services = createTestServices(fixtureContentSource(lesson));
        await renderWithStore(
          <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
          services,
        );

        fireEvent.click(screen.getByRole('button', { name: /^c6,/ }));
        fireEvent.click(screen.getByRole('button', { name: /^e7,/ })); // Ne7+, the scripted move

        // The reply (Kh8) is narrated once shown, after its (short, reduced-motion) delay.
        await screen.findByText('Black moved the king.');
        await screen.findByRole('button', { name: /^h8, black king/ });

        fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
        fireEvent.click(screen.getByRole('button', { name: /^a8,/ })); // Qa8#
        await screen.findByText(/Checkmate!/);
      } finally {
        restoreMatchMedia();
      }
    });
  });
});
