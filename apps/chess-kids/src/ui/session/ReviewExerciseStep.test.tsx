import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ConceptTask } from '@learn/platform-core';
import type { MateInNDef } from '@learn/subject-chess';
import { parseDiagram } from '@learn/subject-chess';
import { chessWeb } from '../../chess-pack.ts';
import '../../app-i18n.ts';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../../testing/fixtures.ts';
import type { FakeNarrator } from '../../testing/fake-narrator.ts';
import { stubMatchMedia } from '../../testing/mock-media-query.ts';
import { renderWithStore } from '../../testing/render-with-store.tsx';
import { createTestServices } from '../../testing/test-services.ts';
import { ReviewExerciseStep } from './ReviewExerciseStep.tsx';

afterEach(cleanup);

describe('ReviewExerciseStep', () => {
  it('narrates the instruction alone on mount, then the instruction and hint note as two separate utterances (M6.3 item 1)', async () => {
    const exercise = fixtureExercise('hint-me');
    const lesson = fixtureLesson({ exercises: [exercise] });
    const services = createTestServices(fixtureContentSource(lesson));
    const task: ConceptTask = { conceptId: exercise.concept, lessonId: lesson.id, exercise };
    const narrator = services.narrator as unknown as FakeNarrator;

    await renderWithStore(
      <ReviewExerciseStep task={task} reviewSource="warmup" onNext={() => {}} />,
      services,
      chessWeb,
    );

    // `fixtureExercise`'s textKey ("fixtures:hint-me") has no real "fixtures" namespace, so i18next
    // falls back to just the key part after the colon.
    await screen.findByText('hint-me');
    // On mount, with no feedback note yet, only the instruction is spoken — not a concatenated
    // "instruction note" string with nothing to append.
    expect(narrator.spoken).toEqual(['hint-me']);

    fireEvent.click(screen.getByRole('button', { name: /Hint/ }));
    await screen.findByText('Look at Rhino.');
    // Two separate utterances, in order — not one `${instruction} ${note}` string (each is looked
    // up for generated audio on its own, `docs/voice.md`).
    expect(narrator.spoken.slice(-2)).toEqual(['hint-me', 'Look at Rhino.']);
  });

  it('F5: a mate-in-2 review task reveals the scripted reply instead of freezing', async () => {
    const restoreMatchMedia = stubMatchMedia('(prefers-reduced-motion: reduce)');
    try {
      // Same fool's-mate-shaped mate-in-2 as core's mate-in-n kind test: 1.Ne7+ Kh8 2.Qa8#.
      const position = parseDiagram(
        [
          '. . . . . . k .',
          '. . . . . p p p',
          '. . N . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          'Q K . . . . . .',
        ].join('\n'),
      );
      const exercise: MateInNDef = {
        id: 'review-mate2',
        concept: 'mate-in-2',
        textKey: 'fixtures:review-mate2',
        position,
        type: 'mate-in-n',
        n: 2,
        line: ['Ne7+', 'Kh8', 'Qa8#'],
      };
      const lesson = fixtureLesson({ exercises: [exercise] });
      const services = createTestServices(fixtureContentSource(lesson));
      const task: ConceptTask = { conceptId: exercise.concept, lessonId: lesson.id, exercise };

      await renderWithStore(
        <ReviewExerciseStep task={task} reviewSource="warmup" onNext={() => {}} />,
        services,
        chessWeb,
      );

      fireEvent.click(screen.getByRole('button', { name: /^c6,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^e7,/ })); // Ne7+, the scripted move

      // Before the F5 fix this never appears: a review task has no reply timer of its own, so the
      // board stays frozen on the kid's own move forever.
      await screen.findByRole('button', { name: /^h8, black king/ });

      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a8,/ })); // Qa8#
      await screen.findByText(/Checkmate!/);
    } finally {
      restoreMatchMedia();
    }
  });
});
