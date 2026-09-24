import type { JSX, ReactNode } from 'react';

export interface GameLayoutProps {
  readonly board: ReactNode;
  readonly panel: ReactNode;
}

/**
 * Shared game-screen layout (Demo, Exercise, Boss): tablet landscape puts the board on the left at
 * up to 75%+ of the available height with the panel on the right; phone portrait stacks the board
 * on top and the panel below (docs/screens.md §1).
 */
export function GameLayout({ board, panel }: GameLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6">
      <div className="flex min-h-0 flex-none items-center justify-center sm:h-full sm:flex-1">
        <div className="aspect-square max-h-[42vh] w-full max-w-[42vh] sm:h-full sm:max-h-full sm:w-auto sm:max-w-full">
          {board}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 sm:w-80 sm:flex-none">{panel}</div>
    </div>
  );
}
