import { useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface UseAsyncResult<T> {
  readonly value: T | undefined;
  readonly setValue: (next: T) => void;
  readonly reload: () => Promise<void>;
}

/**
 * Runs `load()` once on mount and again whenever `deps` changes, replacing 8 hand-written "fetch
 * on mount" effects (refactor-v4.md §2 finding 6). `value` keeps its old contents until the new
 * load settles (never flashes back to `undefined`); state is set only inside `.then`, guarded by a
 * cancel flag so a superseded run's result is dropped, same as each effect already did by hand.
 * `enabled: false` skips the effect entirely (a caller with nothing to load yet).
 * `reload()` reruns `load()` on demand — a save/unlock action's own manual refresh.
 */
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
    // `deps` is the caller's own array (`react-hooks/exhaustive-deps`'s `additionalHooks` checks it
    // at each call site instead), not a literal here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  async function reload(): Promise<void> {
    const loaded = await loadRef.current();
    setValue(loaded);
  }

  return { value, setValue, reload };
}
