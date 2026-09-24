import type { JSX, ReactNode } from 'react';

export interface GameLayoutProps {
  readonly board: ReactNode;
  readonly panel: ReactNode;
  /**
   * Rendered directly under the board, before `panel` — e.g. a `setup` exercise's piece tray on a
   * stacked layout, so it sits above the fold with the board instead of at the bottom of the panel
   * (M2.4 §2b). Callers decide when to pass it (see `useIsStackedLayout`); `GameLayout` itself does
   * not hide or show it by breakpoint.
   */
  readonly belowBoard?: ReactNode;
}

/**
 * Shared game-screen layout (Demo, Exercise, Boss): landscape (≥1024px wide, `lg`) puts the board
 * on the left at up to 75%+ of the available height with the panel on the right; portrait — phone
 * *and* iPad portrait, which is 768px wide but tall, not landscape — stacks the board on top (as
 * large as fits) and the panel below (docs/screens.md §1; fix: iPad portrait was cramped at the
 * old 640px breakpoint, which put a tall, narrow viewport into the side-by-side layout).
 */
export function GameLayout({ board, panel, belowBoard }: GameLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <div className="flex min-h-0 flex-none items-center justify-center lg:h-full lg:flex-1">
        <div className="aspect-square max-h-[42vh] w-full max-w-[42vh] sm:max-h-[46vh] sm:max-w-[46vh] lg:h-full lg:max-h-full lg:w-auto lg:max-w-full">
          {board}
        </div>
      </div>
      {belowBoard}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:w-80 lg:flex-none">{panel}</div>
    </div>
  );
}
