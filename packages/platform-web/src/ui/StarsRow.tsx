import type { JSX } from 'react';
import { StarIcon } from './ds/icons.tsx';

export interface StarsRowProps {
  readonly earned: number;
  readonly max?: number;
  readonly size?: string;
  /** Pop the earned stars in (respects `prefers-reduced-motion` globally, see index.css). */
  readonly animate?: boolean;
}

export function StarsRow({
  earned,
  max = 3,
  size = '2.5rem',
  animate = false,
}: StarsRowProps): JSX.Element {
  return (
    <div className="flex items-end gap-2" aria-hidden="true" data-testid="stars-row">
      {Array.from({ length: max }, (_, index) => {
        const filled = index < earned;
        return (
          <span
            key={index}
            style={{ width: size, height: size }}
            className={`inline-block ${filled ? '' : 'opacity-25 grayscale'} ${
              filled && animate ? 'reward-star-pop' : ''
            }`}
          >
            <StarIcon />
          </span>
        );
      })}
    </div>
  );
}
