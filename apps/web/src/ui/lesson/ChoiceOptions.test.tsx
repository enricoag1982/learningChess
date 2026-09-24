import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ChoiceOption } from '@chess-kids/core';
import '../../i18n.ts';
import { ChoiceOptions } from './ChoiceOptions.tsx';

afterEach(cleanup);

const OPTIONS: readonly ChoiceOption[] = [
  { id: 'queen', piece: { color: 'w', type: 'q' } },
  { id: 'rook', piece: { color: 'w', type: 'r' } },
  { id: 'bishop', piece: { color: 'w', type: 'b' } },
];

describe('ChoiceOptions', () => {
  it('renders every option as a big tile, at least 64px tall (min-h-24)', () => {
    render(<ChoiceOptions options={OPTIONS} wrongOptionIds={[]} onPick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(OPTIONS.length);
    for (const button of buttons) {
      expect(button.className).toContain('min-h-24');
    }
  });

  it('disables a wrong option and marks it orange, leaving the others untouched', () => {
    render(<ChoiceOptions options={OPTIONS} wrongOptionIds={['rook']} onPick={vi.fn()} />);
    const wrong = screen.getByRole('button', { name: 'white rook' });
    const other = screen.getByRole('button', { name: 'white queen' });

    expect(wrong.hasAttribute('disabled')).toBe(true);
    expect(wrong.className).toContain('border-today');
    expect(other.hasAttribute('disabled')).toBe(false);
    expect(other.className).not.toContain('border-today');
  });
});
