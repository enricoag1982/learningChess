import type { GatedNarrator } from '../adapters/narration/gated-narrator.ts';

export interface FakeNarrator extends GatedNarrator {
  /** Every text actually spoken so far (never records one while `setEnabled(false)` — same
   * "voice off means nothing is spoken" contract `GatedNarrator` gives the real narrator). */
  readonly spoken: readonly string[];
  readonly cancelCount: number;
  /** Manual mode only: resolves the current `speak()` as if playback finished on its own (not a
   * cancel) — a no-op otherwise. */
  finish(): void;
}

/**
 * `Narrator` fake for tests: records what it was asked to speak instead of touching Web Speech,
 * and implements `GatedNarrator` itself (real code composes `createGatedNarrator` over the real
 * `createWebSpeechNarrator`; this fake folds the same gating in directly, so `services.narrator`
 * stays one object tests can both drive `setEnabled` on and read `spoken`/`cancelCount` off).
 *
 * `manual: true` (default `false`) makes `speak()` stay pending until `finish()` or `cancel()` is
 * called, mirroring the real narrators' own "resolves when playback ends or is cancelled" contract
 * — for tests of code that reacts to a speech actually finishing (e.g. `speakSequence`).
 */
export function createFakeNarrator(options: { readonly manual?: boolean } = {}): FakeNarrator {
  const manual = options.manual ?? false;
  const spoken: string[] = [];
  let cancelCount = 0;
  let enabled = true;
  let pending: (() => void) | undefined;
  return {
    get available() {
      return enabled;
    },
    spoken,
    get cancelCount() {
      return cancelCount;
    },
    speak(text: string): Promise<void> {
      if (!enabled) return Promise.resolve();
      spoken.push(text);
      if (!manual) return Promise.resolve();
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    cancel(): void {
      cancelCount += 1;
      pending?.();
      pending = undefined;
    },
    setEnabled(next: boolean): void {
      enabled = next;
    },
    finish(): void {
      pending?.();
      pending = undefined;
    },
  };
}
