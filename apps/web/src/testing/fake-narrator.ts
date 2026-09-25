import type { GatedNarrator } from '../adapters/narration/gated-narrator.ts';

export interface FakeNarrator extends GatedNarrator {
  /** Every text actually spoken so far (never records one while `setEnabled(false)` — same
   * "voice off means nothing is spoken" contract `GatedNarrator` gives the real narrator, M5.1). */
  readonly spoken: readonly string[];
  readonly cancelCount: number;
}

/**
 * `Narrator` fake for tests: records what it was asked to speak instead of touching Web Speech,
 * and implements `GatedNarrator` itself (real code composes `createGatedNarrator` over the real
 * `createWebSpeechNarrator`; this fake folds the same gating in directly, so `services.narrator`
 * stays one object tests can both drive `setEnabled` on and read `spoken`/`cancelCount` off).
 */
export function createFakeNarrator(): FakeNarrator {
  const spoken: string[] = [];
  let cancelCount = 0;
  let enabled = true;
  return {
    get available() {
      return enabled;
    },
    spoken,
    get cancelCount() {
      return cancelCount;
    },
    speak(text: string): Promise<void> {
      if (enabled) spoken.push(text);
      return Promise.resolve();
    },
    cancel(): void {
      cancelCount += 1;
    },
    setEnabled(next: boolean): void {
      enabled = next;
    },
  };
}
