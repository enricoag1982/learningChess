import { useEffect, useRef } from 'react';
import type { Narrator } from '@chess-kids/core';
import { speakSequence } from './speakSequence.ts';

/** Speaks `text` through `narrator` on every change (incl. mount); returns a `replay` callback.
 * `mode: 'replay-only'` skips the auto-speak effect for a caller narrating on its own schedule. */
export function useSpeak(
  narrator: Narrator,
  text: string,
  mode: 'auto' | 'replay-only' = 'auto',
): () => void {
  useEffect(() => {
    // Nothing to say (e.g. text still loading), or a caller driving speech itself: leave whatever
    // is playing alone.
    if (mode === 'replay-only' || text === '') return;
    narrator.cancel();
    void narrator.speak(text);
    return () => {
      narrator.cancel();
    };
  }, [narrator, text, mode]);

  return () => {
    narrator.cancel();
    void narrator.speak(text);
  };
}

/** Same as {@link useSpeak} in its default mode — the name Story/Demo call sites use. */
export const useNarratedText = useSpeak;

/** An exercise's instruction plus its feedback note, without re-reading the instruction on every
 * note; a note arriving mid-instruction waits for it (guarded by a `cancelled` ref) instead of
 * cutting it off. `replay` speaks both together, dropping any note still waiting. */
export function useInstructionNarration(
  narrator: Narrator,
  instruction: string,
  note: string | undefined,
): () => void {
  const instructionRunRef = useRef<Promise<void> | null>(null);
  /** Drops a note still waiting for the instruction to end — replay speaks it itself. */
  const cancelWaitingNoteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const run = speakSequence(narrator, [instruction]);
    instructionRunRef.current = run;
    void run.then(() => {
      if (instructionRunRef.current === run) instructionRunRef.current = null;
    });
    return () => {
      void speakSequence(narrator, []); // stop, without starting a new run
    };
  }, [narrator, instruction]);

  useEffect(() => {
    if (!note) return; // cleared back to a plain instruction: nothing to speak
    let cancelled = false;
    const inFlight = instructionRunRef.current;
    if (inFlight) {
      cancelWaitingNoteRef.current = () => {
        cancelled = true;
      };
      void inFlight.then(() => {
        if (!cancelled) void speakSequence(narrator, [note]);
      });
    } else {
      void speakSequence(narrator, [note]);
    }
    return () => {
      cancelled = true;
    };
  }, [narrator, note, instruction]);

  return () => {
    // Replay supersedes the instruction run, which settles it: a note still waiting on that run
    // would then start and cut the replay off, so drop it (replay speaks the note itself).
    cancelWaitingNoteRef.current?.();
    cancelWaitingNoteRef.current = null;
    void speakSequence(narrator, note ? [instruction, note] : [instruction]);
  };
}
