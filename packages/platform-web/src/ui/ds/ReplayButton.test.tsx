import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReplayButton } from './ReplayButton.tsx';

describe('ReplayButton', () => {
  it('shows its label and stays 64px tall by default', () => {
    render(<ReplayButton onClick={vi.fn()} label="Say it again" />);
    const button = screen.getByRole('button', { name: 'Say it again' });
    expect(button.textContent).toBe('Say it again');
    expect(button.className).toContain('h-16');
  });

  it('compact: an icon-only 56px round button, still named by its label', () => {
    const onClick = vi.fn();
    render(<ReplayButton compact onClick={onClick} label="Say it again" />);
    const button = screen.getByRole('button', { name: 'Say it again' });
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Say it again');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.className).toContain('h-14');
    expect(button.className).toContain('w-14');
    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('tap-raised');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
