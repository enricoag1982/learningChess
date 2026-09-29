import type { Narrator } from '@learn/platform-core';

/** A parent "voice" setting (app-structure.md §11) can silence it without every call site checking; `setEnabled(false)` also cancels speech. */
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
