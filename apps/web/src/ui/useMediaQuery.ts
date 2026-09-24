import { useEffect, useState } from 'react';

/** `window.matchMedia(query).matches`, or `false` where `matchMedia` is unavailable (jsdom tests). */
function getMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** Tracks whether `query` currently matches, updating live as the viewport changes. */
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

/**
 * Below Tailwind's `lg` breakpoint (1024px): `GameLayout` stacks the board over the panel (phone
 * and iPad portrait) instead of placing them side by side. In a jsdom test (no `matchMedia`) this
 * defaults to `true`, matching a stacked layout.
 */
export function useIsStackedLayout(): boolean {
  return !useMediaQuery('(min-width: 1024px)');
}
