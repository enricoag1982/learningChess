import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { BestMoveDef, ExerciseDef, YesNoDef } from '@learn/subject-chess';
import { parseDiagram } from '@learn/subject-chess';
import { chessWeb } from '@learn/subject-chess/web/chess-pack.ts';
import '../../app-i18n.ts';
import {
  fixtureContentSource,
  fixtureExercise,
  fixtureLesson,
  fixtureVariantExercise,
} from '@learn/subject-chess/web/testing/fixtures.ts';
import { renderWithStore } from '@learn/platform-web/testing/render-with-store.tsx';
import { createTestServices } from '@learn/subject-chess/web/testing/test-services.ts';
import { ExerciseStep } from '@learn/platform-web/ui/lesson/ExerciseStep.tsx';
import { LessonScreen } from '@learn/platform-web/ui/LessonScreen.tsx';

// M8.35: game screens (docs/screens.md §1): 56px targets, one action row, icon-only replay at the
// owl row's end, the note inside the bubble.

afterEach(cleanup);

const ROW_HINT = `
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  R . . . . . . *
`;

const noteExercise: ExerciseDef = {
  id: 'note-me',
  concept: 'fixture-move',
  textKey: 'fixtures:note-instruction',
  position: parseDiagram(ROW_HINT),
  type: 'collect-stars',
  stars3: 1,
  stars2: 2,
};

describe('lesson header and story / demo steps', () => {
  it('the close button is a 56px round icon button', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(<LessonScreen />, services, chessWeb);
    await act(async () => {
      await store.getState().startLesson(lesson.id);
    });

    const close = await screen.findByRole('button', { name: 'Close lesson' });
    expect(close.className).toContain('h-14');
    expect(close.className).toContain('w-14');
  });

  it('Story and Demo: the replay icon leaves the bubble row; Skip shares one row with the 64px primary', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(<LessonScreen />, services, chessWeb);
    await act(async () => {
      await store.getState().startLesson(lesson.id);
    });

    const steps: readonly { readonly replay: string; readonly primary: RegExp }[] = [
      { replay: 'Listen again', primary: /Let me try/ },
      { replay: 'Say it again', primary: /^Next/ },
    ];
    for (const { replay: replayName, primary: primaryName } of steps) {
      const replay = await screen.findByRole('button', { name: replayName });
      expect(replay.textContent).toBe('');
      expect(replay.className).toContain('w-14');

      const skip = screen.getByRole('button', { name: 'Skip' });
      const primary = screen.getByRole('button', { name: primaryName });
      expect(skip.className).toContain('h-14');
      expect(skip.parentElement).not.toBe(replay.parentElement);
      expect(skip.parentElement).toBe(primary.parentElement);
      expect(skip.nextElementSibling).toBe(primary);
      expect(skip.className).toContain('flex-none!');
      expect(primary.className).toContain('flex-1');
      expect(primary.className).toContain('h-16');
      expect(primary.className).not.toContain('h-20');

      fireEvent.click(primary);
    }
  });
});

describe('exercise action row', () => {
  it('a guided move-counted try: Moves chip (40px, flat), Hint, Undo and Skip share one row; replay is an icon in the avatar column', async () => {
    const lesson = fixtureLesson({ guided: [noteExercise], exercises: [] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep
        lesson={lesson}
        exercise={noteExercise}
        guided
        nextStepIndex={1}
        onSkip={vi.fn()}
      />,
      services,
      chessWeb,
    );

    const hint = screen.getByRole('button', { name: 'Hint' });
    const row = hint.parentElement;
    expect(row).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' }).parentElement).toBe(row);
    expect(screen.getByRole('button', { name: 'Skip' }).parentElement).toBe(row);
    for (const name of ['Hint', 'Undo', 'Skip']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('h-14');
      expect(button.className).not.toContain('h-16');
    }

    // The counter is a flat inline chip in that row: info, never a button, at most 40px tall.
    const chip = screen.getByText('0 of 1').parentElement;
    expect(chip?.parentElement).toBe(row);
    expect(chip?.className).toContain('info-flat');
    expect(chip?.className).toContain('py-2'); // one 24px line + 2 x 8px = 40px
    expect(chip?.className).not.toContain('tap-raised');
    expect(chip?.tagName).not.toBe('BUTTON');
    expect(row?.firstElementChild).toBe(chip);

    const replay = screen.getByRole('button', { name: 'Say it again' });
    expect(replay.textContent).toBe('');
    expect(replay.className).toContain('h-14');
    expect(replay.className).toContain('w-14');
    expect(
      replay.parentElement?.parentElement?.contains(screen.getByText('note-instruction')),
    ).toBe(true);
  });

  it('a hint note sits inside the bubble under the instruction, not in a box of its own', async () => {
    const lesson = fixtureLesson({ exercises: [noteExercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={noteExercise} guided={false} nextStepIndex={3} />,
      services,
      chessWeb,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    const note = await screen.findByText('Look at Rook.');
    const instruction = screen.getByText('note-instruction');
    expect(note.parentElement).toBe(instruction.parentElement);
    expect(note.className).toContain('border-t');
    expect(note.className).not.toContain('rounded');
  });

  it('a scored try has no Skip, and the Easier offer joins Hint / Undo in the same row', async () => {
    const original: BestMoveDef = {
      id: 'orig-me',
      concept: 'fixture-move',
      textKey: 'fixtures:orig',
      position: parseDiagram(ROW_HINT),
      type: 'best-move',
      solutions: ['Rh1'],
      easier: 'orig-me-easy',
    };
    const lesson = fixtureLesson({
      exercises: [original],
      variants: [fixtureVariantExercise('orig-me-easy')],
    });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={original} guided={false} nextStepIndex={3} />,
      services,
      chessWeb,
    );
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^b2,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^b2,/ }));

    const easier = await screen.findByRole('button', { name: 'Easier one' });
    expect(easier.className).toContain('h-14');
    expect(easier.parentElement).toBe(screen.getByRole('button', { name: 'Hint' }).parentElement);
  });

  it('yes-no: Yes / No are 56px answer buttons', async () => {
    const exercise: YesNoDef = {
      id: 'yn-me',
      concept: 'fixture-move',
      textKey: 'fixtures:yn',
      position: parseDiagram(ROW_HINT),
      type: 'yes-no',
      answer: true,
      focus: 'a1',
    };
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
      chessWeb,
    );

    for (const name of ['Yes', 'No']) {
      expect(screen.getByRole('button', { name }).className).toContain('h-14');
    }
  });

  it('the solved state keeps the 64px Next (down from 80px)', async () => {
    const exercise = fixtureExercise('solve-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(
      <ExerciseStep lesson={lesson} exercise={exercise} guided={false} nextStepIndex={3} />,
      services,
      chessWeb,
    );

    fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    const next = await screen.findByRole('button', { name: /^Next/ });
    expect(next.className).toContain('h-16');
    expect(next.className).toContain('text-xl');
    expect(next.className).not.toContain('h-20');
  });
});
