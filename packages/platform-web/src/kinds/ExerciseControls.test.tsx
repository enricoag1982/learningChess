import { describe, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ExerciseControls } from './ExerciseControls.tsx';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: { 'exercise.hint': 'Hint' } } } });

function withI18n(ui: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('ExerciseControls', () => {
  it('lays out chip, Hint, the kind button and the host extras in one row, in that order', () => {
    const onHint = vi.fn();
    render(
      withI18n(
        <ExerciseControls
          showHint
          onHint={onHint}
          info={<span data-testid="chip">Moves 0 of 1</span>}
          slot={<button type="button">Undo</button>}
          extras={<button type="button">Skip</button>}
        />,
      ),
    );

    const hint = screen.getByRole('button', { name: 'Hint' });
    const row = hint.parentElement;
    expect(Array.from(row?.children ?? []).map((node) => node.textContent)).toEqual([
      'Moves 0 of 1',
      'Hint',
      'Undo',
      'Skip',
    ]);
    expect(hint.className).toContain('h-14');
    fireEvent.click(hint);
    expect(onHint).toHaveBeenCalledOnce();
  });

  it('drops only the Hint button when hints are off, keeping the extras', () => {
    render(
      withI18n(
        <ExerciseControls
          showHint={false}
          onHint={vi.fn()}
          extras={<button type="button">Skip</button>}
        />,
      ),
    );
    expect(screen.queryByRole('button', { name: 'Hint' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });
});
