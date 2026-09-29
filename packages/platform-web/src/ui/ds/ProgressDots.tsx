import type { JSX, ReactNode } from 'react';

export function ProgressDots({
  current,
  total,
  hidden = false,
  children,
}: {
  readonly current: number;
  readonly total: number;
  /** Hides the row from assistive tech (a decoration next to a text label). */
  readonly hidden?: boolean;
  readonly children?: ReactNode;
}): JSX.Element {
  return (
    <div
      className="flex items-center justify-center gap-2"
      aria-hidden={hidden ? 'true' : undefined}
    >
      {Array.from({ length: total }, (_, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <span
            key={index}
            className={`h-3 w-3 rounded-full border-2 ${
              state === 'done'
                ? 'border-go bg-go'
                : state === 'current'
                  ? 'border-today bg-white'
                  : 'border-[#E8DFC9] bg-[#E8DFC9]'
            }`}
          />
        );
      })}
      {children}
    </div>
  );
}
