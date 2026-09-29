import type { ButtonHTMLAttributes, HTMLAttributes, JSX, ReactNode } from 'react';
import type { TapLook, TapTone } from './tap.ts';
import { tapClass } from './tap.ts';
import { infoPanelClass, infoPillClass } from './primitives-styles.ts';

/** Shared "tappable vs info" primitives (docs/screens.md §1): `TapButton` for anything tappable
 * (raised, `.tap-raised`), `InfoPanel`/`InfoPill` for read-only content (flat). */

export interface TapButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  readonly look?: TapLook;
  /** Fill tone (default `neutral`: `card`/`ink`, docs/screens.md §1.1). Named `tone`, not `role`:
   * the latter collides with the ARIA `role` attribute a caller may also need to pass. */
  readonly tone?: TapTone;
  readonly type?: 'button' | 'submit';
  readonly children: ReactNode;
}

/** A tappable control: raised card, border, ledge shadow, pressed / disabled / reduced-motion states (`.tap-raised`). */
export function TapButton({
  look = 'custom',
  tone = 'neutral',
  type = 'button',
  className = '',
  children,
  ...rest
}: TapButtonProps): JSX.Element {
  return (
    <button type={type} className={`${tapClass(look, tone)} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export interface InfoPanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly tint?: string;
  readonly children: ReactNode;
}

/** A flat info panel (docs/screens.md §1): a stat row or read-only section that must never look like a button. */
export function InfoPanel({
  tint = 'bg-cream',
  className = '',
  children,
  ...rest
}: InfoPanelProps): JSX.Element {
  return (
    <div className={`${infoPanelClass(tint)} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export interface InfoPillProps extends HTMLAttributes<HTMLDivElement> {
  readonly tint?: string;
  readonly children: ReactNode;
}

/** A flat info pill (docs/screens.md §1): icon + text, no border / shadow; by default no background box, so it never reads as a chip. */
export function InfoPill({
  tint = '',
  className = '',
  children,
  ...rest
}: InfoPillProps): JSX.Element {
  return (
    <div className={`${infoPillClass(tint)} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
