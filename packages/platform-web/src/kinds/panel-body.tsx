import type { JSX, ReactNode } from 'react';

/** `top`, then (solved) `done`, else `controls` wrapped as every kind's panel always has (`mt-auto`, pinned to the bottom). */
export function panelBody(
  top: ReactNode,
  solved: boolean,
  done: ReactNode | null,
  controls: ReactNode,
): JSX.Element {
  return (
    <>
      {top}
      {solved ? done : <div className="mt-auto flex flex-col gap-4">{controls}</div>}
    </>
  );
}
