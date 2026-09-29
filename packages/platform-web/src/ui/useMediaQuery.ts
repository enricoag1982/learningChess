import { useEffect, useState } from 'react';

function getMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => getMatches(query));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(query);
    } catch {
      return;
    }
    const onChange = (): void => {
      setMatches(mql.matches);
    };
    onChange();
    mql.addEventListener('change', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}

/** Below Tailwind's `sm` breakpoint (640px): phone portrait, one compact row of lesson chrome. */
export function useIsCompact(): boolean {
  return !useMediaQuery('(min-width: 640px)');
}

/** `prefers-reduced-motion: reduce`, read once at call time — for an effect/handler outside render
 * (a timer delay, a pause length), not `useMediaQuery`'s own live-tracked render value. */
export function prefersReducedMotion(): boolean {
  return getMatches('(prefers-reduced-motion: reduce)');
}

/** Below Tailwind's `lg` breakpoint (1024px): `GameLayout` stacks the board over the panel. In a
 * jsdom test (no `matchMedia`) this defaults to `true`. */
export function useIsStackedLayout(): boolean {
  return !useMediaQuery('(min-width: 1024px)');
}
