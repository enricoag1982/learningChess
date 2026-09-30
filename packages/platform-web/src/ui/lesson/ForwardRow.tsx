import type { JSX } from 'react';
import { NextButton } from './NextButton.tsx';
import { SkipButton } from './SkipButton.tsx';

export interface ForwardRowProps {
  readonly onNext: () => void;
  /** Story / Demo: Skip on the left at its own width; without it the primary spans the row. */
  readonly onSkip?: () => void;
  readonly label?: string;
  readonly className?: string;
}

/** Story / Demo's bottom row: Skip beside the primary forward action, which takes the rest. */
export function ForwardRow({
  onNext,
  onSkip,
  label,
  className = '',
}: ForwardRowProps): JSX.Element {
  return (
    <div className={`flex gap-3 ${className}`}>
      {onSkip && <SkipButton onClick={onSkip} className="flex-none!" />}
      <NextButton onClick={onNext} label={label} className="flex-1" />
    </div>
  );
}
