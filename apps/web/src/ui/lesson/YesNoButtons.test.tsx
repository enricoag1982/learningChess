import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../../i18n.ts';
import { YesNoButtons } from './YesNoButtons.tsx';

afterEach(cleanup);

describe('YesNoButtons', () => {
  it('renders Yes and No identically: same className, neither styled as the primary action', () => {
    render(<YesNoButtons onAnswer={vi.fn()} />);
    const yes = screen.getByRole('button', { name: 'Yes' });
    const no = screen.getByRole('button', { name: 'No' });
    expect(yes.className).toBe(no.className);
    // Neither button carries the shared primary (green, `bg-go`) button style.
    expect(yes.className).not.toContain('bg-go');
    expect(no.className).not.toContain('bg-go');
  });

  it('disables and marks only the picked wrong value', () => {
    render(<YesNoButtons wrongValue={false} onAnswer={vi.fn()} />);
    const yes = screen.getByRole('button', { name: 'Yes' });
    const no = screen.getByRole('button', { name: 'No' });

    expect(no.hasAttribute('disabled')).toBe(true);
    expect(no.className).toContain('border-today');
    expect(yes.hasAttribute('disabled')).toBe(false);
    expect(yes.className).not.toContain('border-today');
  });
});
