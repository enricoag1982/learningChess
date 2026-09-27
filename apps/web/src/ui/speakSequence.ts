import type { Narrator } from '@chess-kids/core';

/**
 * Tracks, per `Narrator` instance, which `speakSequence` run is the current one. A fresh call for
 * the same `narrator` — even an empty one, used only to stop the current run without starting a new
 * one (`useInstructionNarration`'s cleanup) — always supersedes whatever came before it, the same
 * "newer call wins" contract `speak`/`cancel` already give a single utterance
 * (`audio-narrator.ts`'s own token; `docs/voice.md` "Fallback rules"), extended here across a short
 * run of several. A `WeakMap` (not a field on the narrator itself) keeps this out of the `Narrator`
 * port — any narrator works, including test fakes.
 */
const tokens = new WeakMap<Narrator, number>();

function nextToken(narrator: Narrator): number {
  const next = (tokens.get(narrator) ?? 0) + 1;
  tokens.set(narrator, next);
  return next;
}

/**
 * Speaks each of `texts` through `narrator`, one after another, each waiting for the previous to
 * finish — so every text gets its own generated-audio lookup, instead of one concatenated string
 * that could never be in the manifest (`docs/voice.md` "Sequence"; M6.3 item 1: the exercise
 * instruction, then its feedback note). A newer call for the same `narrator` (another
 * `speakSequence`, including an empty `texts` used only to cancel) stops this run before its next
 * text starts: `narrator.speak()` already resolves a superseded call's own promise on its own (the
 * narrator's own cancellation), so this only has to notice, via one token per narrator, that it is
 * no longer the current run before continuing past an `await`.
 */
export function speakSequence(narrator: Narrator, texts: readonly string[]): Promise<void> {
  const myToken = nextToken(narrator);
  narrator.cancel();
  return (async () => {
    for (const text of texts) {
      if (tokens.get(narrator) !== myToken) return;
      await narrator.speak(text);
      if (tokens.get(narrator) !== myToken) return;
    }
  })();
}
