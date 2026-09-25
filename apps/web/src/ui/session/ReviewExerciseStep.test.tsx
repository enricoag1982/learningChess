import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ConceptTask } from '@chess-kids/core';
import '../../i18n.ts';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../../testing/fixtures.ts';
import type { FakeNarrator } from '../../testing/fake-narrator.ts';
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
});
