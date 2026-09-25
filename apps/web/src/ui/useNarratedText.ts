import { useEffect } from 'react';
import type { Narrator } from '@chess-kids/core';
import { speakSequence } from './speakSequence.ts';

/**
 * Speaks `text` through `narrator` whenever it changes (including on mount), and returns a
 * `replay` callback for a "Listen again" / "Say it again" button. Subtitles are the caller's job:
 * this only drives the voice side of "every text is spoken, and repeatable" (non-functional.md §2).
 */
export function useNarratedText(narrator: Narrator, text: string): () => void {
  useEffect(() => {
    narrator.cancel();
    void narrator.speak(text);
    return () => {
      narrator.cancel();
    };
  }, [narrator, text]);

  return () => {
    narrator.cancel();
    void narrator.speak(text);
  };
}

/**
 * Same contract as `useNarratedText`, but for two or more texts spoken one after another (M6.3
 * item 1: an exercise's instruction, then its feedback note) — each gets its own generated-audio
 * lookup (`speakSequence.ts`), instead of one string concatenating both, which could never be in
 * the manifest. `texts` is compared by a joined key, not array identity (a fresh array every
 * render), so this only re-speaks when the actual words change.
 */
export function useNarratedTextSequence(narrator: Narrator, texts: readonly string[]): () => void {
  const key = texts.join('\u0000');

  useEffect(() => {
    void speakSequence(narrator, texts);
    return () => {
      void speakSequence(narrator, []); // stop, without starting a new run
    };
    // `texts` itself is deliberately not a dep: `key` above is its stable, content-based identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrator, key]);

  return () => {
    void speakSequence(narrator, texts);
  };
}
