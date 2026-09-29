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
