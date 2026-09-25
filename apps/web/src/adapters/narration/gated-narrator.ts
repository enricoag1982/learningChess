import type { Narrator } from '@chess-kids/core';

/** A `Narrator` that a parent-set "voice" setting (M5.1, app-structure.md §11) can silence, without
 * every call site needing to check that setting itself — `setEnabled(false)` also cancels whatever
 * `inner` is mid-speaking, same as a kid tapping mute (subtitles stay shown regardless: this only
 * ever gates the *spoken* half). Enabled by default so a profile with none loaded yet keeps
 * speaking, same as before this setting existed. */
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
