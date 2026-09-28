import type { Narrator } from '@learn/platform-core';

/** A `Narrator` a parent-set "voice" setting (app-structure.md §11) can silence without every call
 * site checking it itself; `setEnabled(false)` also cancels whatever is mid-speaking. */
export interface GatedNarrator extends Narrator {
  setEnabled(enabled: boolean): void;
}

export function createGatedNarrator(inner: Narrator): GatedNarrator {
  let enabled = true;
  return {
    get available(): boolean {
      return enabled && inner.available;
    },
    speak(text: string): Promise<void> {
      return enabled ? inner.speak(text) : Promise.resolve();
    },
    cancel(): void {
      inner.cancel();
    },
    setEnabled(next: boolean): void {
      enabled = next;
      if (!next) inner.cancel();
    },
  };
}
