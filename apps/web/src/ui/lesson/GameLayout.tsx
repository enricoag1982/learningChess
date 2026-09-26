import { useLayoutEffect, useRef, useState } from 'react';
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
 * The board: the largest square that fits the space the panel leaves over, measured
 * (`ResizeObserver`), never a fixed share of the viewport (owner report 2026-09-26, iPad mini 4:
 * the old `42–46vh` cap — iOS Safari's `vh` is the toolbar-hidden height — plus a tall panel pushed
 * Check / Next below the fold). The panel's height varies (instruction length, note, tray, boss
 * counters), so no fixed cap both fits the tallest panel and keeps the board large on the rest.
 *
 * Shrink-only while mounted (each exercise / round remounts it), so a note coming and going does not
 * make the board grow and shrink under the kid's finger (a shrink eases over 200 ms, none with
 * reduced motion); a window resize (rotation, Safari toolbars) re-fits it both ways. No-op
 * (unsized, CSS-square) where `ResizeObserver` is unavailable (jsdom).
 */
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

/**
 * Shared game-screen layout (Demo, Exercise, Boss): landscape (≥1024px wide, `lg`) puts the board
 * on the left, as large as the row allows, with the panel on the right; portrait — phone *and* iPad
 * portrait, which is 768px wide but tall, not landscape — stacks the panel at its natural height
 * below the board, and the board takes all the height left (docs/screens.md §1; fix: iPad portrait
 * was cramped at the old 640px breakpoint, which put a tall, narrow viewport into the side-by-side
 * layout). Floor 240px (`min-h-60`): below that a very short screen scrolls instead. Fit checked by
 * `e2e/fit.spec.ts` (iPad mini visible area, phone).
 */
export function GameLayout({ board, panel, belowBoard }: GameLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <FitSquare>{board}</FitSquare>
      {belowBoard}
      <div className="flex flex-none flex-col gap-4 lg:min-h-0 lg:w-80">{panel}</div>
    </div>
  );
}
