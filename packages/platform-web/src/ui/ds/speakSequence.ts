import type { Narrator } from '@learn/platform-core';

/** Which `speakSequence` run is current per `Narrator`; a fresh call (even an empty one, to stop) supersedes the last. A
 * `WeakMap` keeps it out of the `Narrator` port, so any narrator works. */
const tokens = new WeakMap<Narrator, number>();

function nextToken(narrator: Narrator): number {
  const next = (tokens.get(narrator) ?? 0) + 1;
  tokens.set(narrator, next);
  return next;
}

/** Speaks each of `texts` in turn so each gets its own generated-audio lookup; a newer call for the same `narrator` stops this
 * run before its next text (token checked past each `await`). */
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
