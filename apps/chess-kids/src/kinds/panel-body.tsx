import type { JSX, ReactNode } from 'react';

/** `top` (bubble + replay row), then — solved — `done`, else `controls` wrapped the same way every
 * kind's panel always has (`mt-auto`, pinning it to the panel's bottom). Shared so no kind repeats
 * this wrapper by hand. */
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
