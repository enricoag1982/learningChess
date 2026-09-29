import { useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface UseAsyncResult<T> {
  readonly value: T | undefined;
  readonly setValue: (next: T) => void;
  readonly reload: () => Promise<void>;
}

/** Runs `load()` on mount and when `deps` change; `value` keeps its old contents until the new load settles (a cancel flag
 * guards a superseded run). `enabled: false` skips it; `reload()` reruns on demand. */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  enabled = true,
): UseAsyncResult<T> {
  const [value, setValue] = useState<T | undefined>(undefined);
  const loadRef = useRef(load);
  // Keeps the ref in sync after every render — never during render itself (react-hooks/refs).
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadRef.current().then((loaded) => {
      if (!cancelled) setValue(loaded);
    });
    return () => {
      cancelled = true;
    };
    // `deps` is checked at each call site instead, not a literal here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  async function reload(): Promise<void> {
    const loaded = await loadRef.current();
    setValue(loaded);
  }

  return { value, setValue, reload };
}
