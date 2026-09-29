import type { JSX } from 'react';
import type { Problem } from '../core/types.ts';

export interface ProblemCardProps {
  readonly problem: Problem;
  /** Draws the problem as two groups of dots under the numerals. */
  readonly dots: boolean;
  /** The result to show after `=`; `?` while it is still the kid's to find. */
  readonly answer?: number;
  /** A small card for the Story step. */
  readonly compact?: boolean;
}

function DotGroup({
  count,
  group,
  crossed,
  compact,
}: {
  readonly count: number;
  readonly group: 'a' | 'b';
  readonly crossed: boolean;
  readonly compact: boolean;
}): JSX.Element {
  const size = compact ? 'h-3 w-3' : 'h-6 w-6 sm:h-7 sm:w-7';
  const fill = group === 'a' ? 'bg-go' : crossed ? 'bg-line' : 'bg-today';
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          data-group={group}
          data-crossed={crossed}
          className={`relative inline-block rounded-full ${size} ${fill}`}
        >
          {crossed && (
            <span className="absolute inset-x-[-15%] top-1/2 h-0.5 -rotate-45 rounded-full bg-ink" />
          )}
        </span>
      ))}
    </div>
  );
}

/** The problem as the kid sees it: `a op b = ?` and, on request, its two dot groups (for `-`, the second is crossed out).
 * The dots are decoration: the numerals carry the meaning. */
export function ProblemCard({
  problem,
  dots,
  answer,
  compact = false,
}: ProblemCardProps): JSX.Element {
  const { a, op, b } = problem;
  const result = answer === undefined ? '?' : String(answer);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-line bg-card p-3">
      <p
        className={`text-center font-display font-bold text-ink ${compact ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}
      >
        {`${String(a)} ${op} ${String(b)} = ${result}`}
      </p>
      {dots && (
        <div
          aria-hidden="true"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          <DotGroup count={a} group="a" crossed={false} compact={compact} />
          <DotGroup count={b} group="b" crossed={op === '-'} compact={compact} />
        </div>
      )}
    </div>
  );
}
