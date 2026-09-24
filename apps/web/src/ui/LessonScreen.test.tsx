import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import '../i18n.ts';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { createTestServices } from '../testing/test-services.ts';
import { LessonScreen } from './LessonScreen.tsx';

afterEach(cleanup);

describe('LessonScreen', () => {
  it('Story: "Let me try" advances to the Demo step', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(<LessonScreen />, services);
    await act(async () => {
      await store.getState().startLesson(lesson.id);
    });

    await screen.findByRole('button', { name: /Let me try/ });
    fireEvent.click(screen.getByRole('button', { name: /Let me try/ }));

    await screen.findByRole('button', { name: /^Next/ });
    expect(store.getState().stepIndex).toBe(1);
  });
});
