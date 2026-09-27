import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../ui/lesson/button-styles.ts';

function HintIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export interface ExerciseControlsProps {
  readonly showHint: boolean;
  readonly onHint: () => void;
  /** select-squares' Check button, or a move-counted kind's Undo button; `undefined` otherwise. */
  readonly slot?: ReactNode;
}

/** The controls row every kind starts with: Hint (unless hidden), then its own one extra button,
 * if any (select-squares' Check or a move-counted kind's Undo — never both). */
export function ExerciseControls({ showHint, onHint, slot }: ExerciseControlsProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      {showHint && (
        <button type="button" onClick={onHint} className={SECONDARY_BUTTON}>
          <HintIcon />
          {t('exercise.hint')}
        </button>
      )}
      {slot}
    </div>
  );
}
