import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../../i18n.ts';
import { PhaseChip } from './PhaseChip.tsx';

afterEach(cleanup);

describe('PhaseChip (phone)', () => {
  it('names skipped phases for screen readers and stripes them in the mini track', () => {
    const { container } = render(<PhaseChip phase="try" skippedPhases={['story', 'demo']} />);
    expect(screen.getByText('Story, skipped, Demo, skipped')).toBeTruthy();
    const bars = container.querySelectorAll('span[aria-hidden="true"] > span');
    expect(bars).toHaveLength(5);
    expect(bars[0]?.className).toContain('repeating-linear-gradient');
    expect(bars[1]?.className).toContain('repeating-linear-gradient');
    expect(bars[2]?.className).toContain('bg-today');
    expect(bars[3]?.className).toContain('bg-line');
  });

  it('shows done phases as solid green when nothing was skipped', () => {
    const { container } = render(<PhaseChip phase="exercises" />);
    const bars = container.querySelectorAll('span[aria-hidden="true"] > span');
    expect(bars[0]?.className).toContain('bg-go');
    expect(bars[2]?.className).toContain('bg-go');
    expect(bars[3]?.className).toContain('bg-today');
  });
});
