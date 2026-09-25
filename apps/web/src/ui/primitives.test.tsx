import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InfoPanel, InfoPill, TapButton } from './primitives.tsx';

afterEach(cleanup);

describe('TapButton', () => {
  it('renders the raised marker class, plus a role class for a colour role', () => {
    render(
      <TapButton variant="primary" role="go">
        Go
      </TapButton>,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button.className).toContain('tap-raised');
    expect(button.className).toContain('tap-go');
  });

  it('carries no colour-role class for the default neutral role', () => {
    render(<TapButton variant="secondary">Neutral</TapButton>);
    const button = screen.getByRole('button', { name: 'Neutral' });
    expect(button.className).toContain('tap-raised');
    expect(button.className).not.toMatch(/tap-(go|today|info)\b/);
  });

  it('is a real native disabled button when disabled (the CSS `:disabled` rule needs it)', () => {
    render(
      <TapButton variant="chip" disabled onClick={vi.fn()}>
        Locked
      </TapButton>,
    );
    const button = screen.getByRole('button', { name: 'Locked' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.className).toContain('tap-raised');
  });

  it('defaults to a native button type (never submits a form by accident)', () => {
    render(<TapButton variant="primary">Submit-looking</TapButton>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});

describe('InfoPanel / InfoPill', () => {
  it('InfoPanel is flat: no raised marker class', () => {
    render(<InfoPanel>Read-only</InfoPanel>);
    const panel = screen.getByText('Read-only');
    expect(panel.className).toContain('info-flat');
    expect(panel.className).not.toContain('tap-raised');
  });

  it('InfoPill is flat too, and never renders as a `<button>`', () => {
    render(<InfoPill aria-label="3 stars">★ 3</InfoPill>);
    const pill = screen.getByLabelText('3 stars');
    expect(pill.tagName).toBe('DIV');
    expect(pill.className).toContain('info-flat');
    expect(pill.className).not.toContain('tap-raised');
  });
});

describe('.tap-raised (index.css)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('defines the raised look: border, ledge shadow, and per-role ledge tokens', () => {
    expect(css).toMatch(/\.tap-raised\s*\{[^}]*box-shadow:\s*0 4px 0 0 var\(--tap-ledge\)/);
    expect(css).toContain('--color-ledge-go');
    expect(css).toContain('--color-ledge-today');
    expect(css).toContain('--color-ledge-info');
    expect(css).toContain('--color-ledge-card');
  });

  it('moves down and shrinks the ledge when pressed, never removes it entirely', () => {
    expect(css).toMatch(
      /\.tap-raised:active:not\(:disabled\)\s*\{\s*transform:\s*translateY\(2px\);\s*box-shadow:\s*0 2px 0 0 var\(--tap-ledge\);/,
    );
  });

  it('removes the ledge (not the shape) when disabled', () => {
    expect(css).toMatch(/\.tap-raised:disabled\s*\{\s*box-shadow:\s*none;/);
  });

  it('respects reduced motion: no movement on press, a darker fill instead', () => {
    // Two `@media (prefers-reduced-motion: reduce)` blocks exist: `.tap-raised`'s own (first, inside
    // `@layer components`) and the pre-existing global one further down — split(...)[1] is the text
    // between them, i.e. exactly `.tap-raised`'s own block body.
    const reducedMotionBlock = css.split('@media (prefers-reduced-motion: reduce)')[1];
    expect(reducedMotionBlock).toBeDefined();
    expect(reducedMotionBlock).toMatch(/\.tap-raised\s*\{\s*transition:\s*none;/);
    expect(reducedMotionBlock).toMatch(
      /\.tap-raised:active:not\(:disabled\)\s*\{\s*transform:\s*none;/,
    );
    expect(reducedMotionBlock).toContain('filter: brightness(0.94);');
  });

  it('gives every tappable a 3px info focus ring', () => {
    expect(css).toMatch(
      /\.tap-raised:focus-visible\s*\{\s*outline:\s*3px solid var\(--color-info\);/,
    );
  });
});
