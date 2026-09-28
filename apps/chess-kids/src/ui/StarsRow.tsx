import type { JSX } from 'react';
import { StarIcon } from './board/pieces.tsx';

export interface StarsRowProps {
  readonly earned: number;
  readonly max?: number;
  /** CSS size (Tailwind arbitrary width/height), e.g. "3rem". */
  readonly size?: string;
  /** Pop the earned stars in (respects `prefers-reduced-motion` globally, see index.css). */
  readonly animate?: boolean;
}

/** A row of up to `max` stars, `earned` of them filled gold and the rest dim. Purely decorative. */
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
