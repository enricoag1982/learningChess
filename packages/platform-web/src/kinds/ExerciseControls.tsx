import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Svg } from '../ui/ds/icons.tsx';
import { SECONDARY_BUTTON } from '../ui/lesson/button-styles.ts';

const HintIcon = (): JSX.Element => (
  <Svg size={26}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </Svg>
);

export interface ExerciseControlsProps {
  readonly showHint: boolean;
  readonly onHint: () => void;
  /** A read-only chip that leads the row (a move-counted kind's Moves counter). */
  readonly info?: ReactNode;
  /** select-squares' Check button, or a move-counted kind's Undo button; `undefined` otherwise. */
  readonly slot?: ReactNode;
  /** The host's own buttons for this row (`PlayAreaProps.actions`: Skip on a guided try, the Easier offer). */
  readonly extras?: ReactNode;
}

/** The exercise's one action row: leading chip, Hint (unless hidden), the kind's extra button, then the host's extras.
 * Wraps only where the row is narrow (`@xl`), and then only to give the chip a line of its own. */
export function ExerciseControls({
  showHint,
  onHint,
  info,
  slot,
  extras,
}: ExerciseControlsProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="@container flex flex-wrap items-center gap-3">
      {info}
      {showHint && (
        <button type="button" onClick={onHint} className={SECONDARY_BUTTON}>
          <HintIcon />
          {t('exercise.hint')}
        </button>
      )}
      {slot}
      {extras}
    </div>
  );
}
