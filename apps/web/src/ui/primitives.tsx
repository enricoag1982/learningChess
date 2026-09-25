import type { ButtonHTMLAttributes, HTMLAttributes, JSX, ReactNode } from 'react';
import type { TapRole, TapVariant } from './primitives-styles.ts';
import { infoPanelClass, infoPillClass, tapButtonClass } from './primitives-styles.ts';

/**
 * Shared "tappable vs info" primitives (docs/screens.md §1, roadmap F3): `TapButton` for anything
 * tappable (raised: border + ledge shadow, pressed/disabled/reduced-motion states, focus ring —
 * all from `.tap-raised` in `index.css`), `InfoPanel`/`InfoPill` for read-only content (flat: no
 * border/shadow, tinted background, smaller radius). Screens either render these directly or, for
 * a native `<button>` that needs its own extra markup/props, import `tapButtonClass`/
 * `infoPanelClass`/`infoPillClass` straight from `primitives-styles.ts` — the lesson
 * (`lesson/button-styles.ts`) and parent-area (`parent/parent-styles.ts`) shared class constants
 * are themselves built from those, so every screen ends up on one token system, not ad-hoc
 * borders/shadows of its own.
 */

export interface TapButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  readonly variant: TapVariant;
  /** Fill role (default `neutral`: `card`/`line`, docs/screens.md §1.1). */
  readonly role?: TapRole;
  readonly type?: 'button' | 'submit';
  readonly children: ReactNode;
}

/** A tappable control: raised card, border, ledge shadow, pressed/disabled/reduced-motion states
 * (`.tap-raised` in `index.css`). Every tappable already carries an icon or a label by the
 * existing rule (docs/screens.md §1) — `children` is exactly that. */
export function TapButton({
  variant,
  role = 'neutral',
  type = 'button',
  className = '',
  children,
  ...rest
}: TapButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={`${tapButtonClass(variant, role)} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface InfoPanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly tint?: string;
  readonly children: ReactNode;
}

/** A flat info panel (docs/screens.md §1 "Info only"): a stat row, a read-only section, anything
 * that must never look like a button. */
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

/** A flat info pill (docs/screens.md §1 "Pills" / "Info = no box"): rank / stars / streak, or any
 * other small read-only counter — icon + text, no border, no shadow, and (default `tint`) no
 * background box either, so it never reads as a tappable chip. */
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
