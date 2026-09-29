import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProblemCard } from './problem-card.tsx';

function dotsOf(group: 'a' | 'b'): readonly Element[] {
  return [...document.querySelectorAll(`[data-group="${group}"]`)];
}

describe('ProblemCard', () => {
  it('shows the sum as text with the result still hidden', () => {
    render(<ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots={false} />);
    expect(screen.getByText('3 + 2 = ?')).toBeTruthy();
    expect(document.querySelectorAll('[data-group]')).toHaveLength(0);
  });

  it('shows the answer after the equals sign when given', () => {
    render(<ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots={false} answer={5} />);
    expect(screen.getByText('3 + 2 = 5')).toBeTruthy();
  });

  it('draws two groups of dots for a sum, none crossed out', () => {
    render(<ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots />);
    expect(dotsOf('a')).toHaveLength(3);
    expect(dotsOf('b')).toHaveLength(2);
    expect(document.querySelectorAll('[data-crossed="true"]')).toHaveLength(0);
  });

  it('crosses out the second group for a difference', () => {
    render(<ProblemCard problem={{ a: 5, op: '-', b: 2 }} dots />);
    expect(dotsOf('a')).toHaveLength(5);
    expect(dotsOf('b')).toHaveLength(2);
    expect(dotsOf('a').every((dot) => dot.getAttribute('data-crossed') === 'false')).toBe(true);
    expect(dotsOf('b').every((dot) => dot.getAttribute('data-crossed') === 'true')).toBe(true);
  });

  it('shows the typed digits after the equals sign as a polite, named output', () => {
    render(<ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots={false} entry="4" />);
    const output = screen.getByRole('status', { name: 'Your answer: 4' });
    expect(output.textContent).toBe('4');
    expect(output.getAttribute('aria-live')).toBe('polite');
    expect(output.closest('p')?.textContent).toBe('3 + 2 = 4');
  });

  it('shows ? for an empty entry, and a wrong value struck through and orange', () => {
    const { rerender } = render(
      <ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots={false} entry="" />,
    );
    expect(screen.getByRole('status', { name: 'Your answer: ?' }).textContent).toBe('?');

    rerender(
      <ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots={false} entry="" wrongValue={7} />,
    );
    const wrong = screen.getByRole('status', { name: 'Your answer: 7' });
    expect(wrong.className).toContain('line-through');
    expect(wrong.className).toContain('text-today');

    rerender(
      <ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots={false} entry="1" wrongValue={7} />,
    );
    expect(screen.getByRole('status', { name: 'Your answer: 1' }).className).not.toContain(
      'line-through',
    );
  });

  it('hides the dots from assistive technology', () => {
    render(<ProblemCard problem={{ a: 3, op: '+', b: 2 }} dots />);
    const container = dotsOf('a')[0]?.closest('[aria-hidden="true"]');
    expect(container).not.toBeNull();
    expect(container?.querySelectorAll('[data-group]')).toHaveLength(5);
  });
});
