import { useLayoutEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';

export interface GameLayoutProps {
  readonly board: ReactNode;
  readonly panel: ReactNode;
  /** Rendered directly under the board, before `panel` — e.g. a `setup` exercise's piece tray on a
   * stacked layout, so it sits above the fold instead of at the bottom of the panel. */
  readonly belowBoard?: ReactNode;
}

/** The board: the largest square that fits the space the panel leaves over, measured
 * (`ResizeObserver`, since the panel's height varies); shrink-only while mounted so a note coming
 * and going does not grow/shrink the board under the kid's finger. No-op in jsdom. */
function FitSquare({ children }: { readonly children: ReactNode }): JSX.Element {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const fit = (): number => {
      const rect = area.getBoundingClientRect();
      return Math.max(0, Math.floor(Math.min(rect.width, rect.height)));
    };
    // First size now, before paint: the observer's first callback lands a frame later.
    setSize(fit());
    const observer = new ResizeObserver(() => {
      const next = fit();
      setSize((previous) => (previous === null ? next : Math.min(previous, next)));
    });
    observer.observe(area);
    const onWindowResize = (): void => {
      setSize(fit());
    };
    window.addEventListener('resize', onWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  return (
    <div
      ref={areaRef}
      className="flex min-h-60 min-w-0 flex-1 items-center justify-center lg:min-h-0"
    >
      <div
        className={
          size === null
            ? 'aspect-square h-full max-h-full w-full max-w-full'
            : 'transition-[width,height] duration-200 motion-reduce:transition-none'
        }
        style={size === null ? undefined : { width: size, height: size }}
      >
        {children}
      </div>
    </div>
  );
}

/** Shared game-screen layout (Demo, Exercise, Boss): landscape puts the board left, panel right;
 * portrait stacks the panel below (docs/screens.md §1). Floor 240px, else scrolls. */
export function GameLayout({ board, panel, belowBoard }: GameLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <FitSquare>{board}</FitSquare>
      {belowBoard}
      <div className="flex flex-none flex-col gap-4 lg:min-h-0 lg:w-80">{panel}</div>
    </div>
  );
}
