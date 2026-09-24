import { useEffect } from 'react';
import type { Narrator } from '@chess-kids/core';

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
