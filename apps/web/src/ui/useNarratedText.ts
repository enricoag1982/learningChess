import { useEffect, useRef } from 'react';
import type { Narrator } from '@chess-kids/core';
import { speakSequence } from './speakSequence.ts';

/**
 * Speaks `text` through `narrator` whenever it changes (including on mount), and returns a
 * `replay` callback for a "Listen again" / "Say it again" button. Subtitles are the caller's job:
 * this only drives the voice side of "every text is spoken, and repeatable" (non-functional.md §2).
 */
export function useNarratedText(narrator: Narrator, text: string): () => void {
  useEffect(() => {
    // Nothing to say (e.g. text still loading): leave whatever is playing alone.
    if (text === '') return;
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
 * An exercise (or series-boss round)'s instruction plus its feedback note, without re-reading the
 * instruction on every note (owner report 2026-09-26: submit re-read the whole instruction before
 * the feedback, every time). `instruction` is spoken once on mount and again whenever it changes
 * (e.g. a series-boss round change). `note` is spoken alone — its own `speakSequence` call, never
 * prefixed with the instruction again — whenever it changes to a non-empty value; `note` becoming
 * `undefined` (feedback cleared back to a plain instruction) speaks nothing.
 *
 * A note that arrives while the instruction is still being read (a guided try's auto-shown hint
 * level 1, right after mount) does not cut the instruction off: the in-flight instruction's
 * `speakSequence` run is tracked in a ref, and the note effect waits for it to settle before
 * speaking — unless superseded meanwhile by a newer note, an instruction change, or unmount, guarded
 * by a `cancelled` flag set in that effect's own cleanup. The ref itself is cleared once its run
 * settles, but only while it is still the current one (a newer instruction may already have
 * replaced it).
 *
 * Returns a `replay` callback ("Say it again") that speaks the instruction and current note
 * together, from the top, same as before this change (dropping a note still waiting on the
 * instruction, which would otherwise start when the replay supersedes it and cut the replay off).
 */
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
