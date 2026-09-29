import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Problem } from '../core/types.ts';

export interface ProblemCardProps {
  readonly problem: Problem;
  /** Draws the problem as two groups of dots under the numerals. */
  readonly dots: boolean;
  /** The result to show after `=`; `?` while it is still the kid's to find. */
  readonly answer?: number;
  /** A small card for the Story step. */
  readonly compact?: boolean;
  /** The digits typed so far, shown after `=` in place of the result (`?` while empty). */
  readonly entry?: string;
  /** The last wrong answer: orange and struck through until the next digit. */
  readonly wrongValue?: number;
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

/** What the kid has typed, announced politely as it changes; only the number is struck when it was wrong. */
function Entry({
  entry,
  wrongValue,
}: {
  readonly entry: string;
  readonly wrongValue?: number;
}): JSX.Element {
  const { t } = useTranslation();
  const showWrong = entry === '' && wrongValue !== undefined;
  const value = showWrong ? String(wrongValue) : entry === '' ? '?' : entry;
  return (
    <output
      aria-live="polite"
      aria-label={t('math.entry-label', { value })}
      className={showWrong ? 'text-today line-through' : undefined}
    >
      {value}
    </output>
  );
}

/** The problem as the kid sees it: `a op b = ?` and, on request, its two dot groups (for `-`, the second is crossed out).
 * The dots are decoration: the numerals carry the meaning. */
export function ProblemCard({
  problem,
  dots,
  answer,
  compact = false,
  entry,
  wrongValue,
}: ProblemCardProps): JSX.Element {
  const { a, op, b } = problem;
  const result = answer === undefined ? '?' : String(answer);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-line bg-card p-3">
      <p
        className={`text-center font-display font-bold text-ink ${compact ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}
      >
        {entry === undefined ? (
          `${String(a)} ${op} ${String(b)} = ${result}`
        ) : (
          <>
            {`${String(a)} ${op} ${String(b)} = `}
            <Entry entry={entry} wrongValue={wrongValue} />
          </>
        )}
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
