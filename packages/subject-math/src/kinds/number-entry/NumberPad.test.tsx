import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NumberPad } from './NumberPad.tsx';

function renderPad(canCheck: boolean) {
  const handlers = { onDigit: vi.fn(), onErase: vi.fn(), onCheck: vi.fn() };
  render(<NumberPad {...handlers} canCheck={canCheck} />);
  return handlers;
}

describe('NumberPad', () => {
  it('has 12 keys in a labelled group: 1-9, then Delete, 0 and Check', () => {
    renderPad(true);
    const pad = screen.getByRole('group', { name: 'Number pad' });
    const names = within(pad)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete', '0', 'Check']);
  });

  it('makes every key at least 64px square (h-16 min-w-16)', () => {
    renderPad(true);
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('h-16');
      expect(button.className).toContain('min-w-16');
    }
  });

  it('disables Check while nothing is typed and enables it otherwise', () => {
    renderPad(false);
    expect(screen.getByRole('button', { name: 'Check' }).hasAttribute('disabled')).toBe(true);
    for (const digit of ['0', '5']) {
      expect(screen.getByRole('button', { name: digit }).hasAttribute('disabled')).toBe(false);
    }
    expect(screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled')).toBe(false);
  });

  it('reports digits, Delete and Check', () => {
    const { onDigit, onErase, onCheck } = renderPad(true);
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onDigit.mock.calls).toEqual([[7], [0]]);
    expect(onErase).toHaveBeenCalledOnce();
    expect(onCheck).toHaveBeenCalledOnce();
  });
});
