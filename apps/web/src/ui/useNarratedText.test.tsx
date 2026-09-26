import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Narrator } from '@chess-kids/core';
import { createFakeNarrator } from '../testing/fake-narrator.ts';
import { useInstructionNarration } from './useNarratedText.ts';

// Owner report 2026-09-26: submit re-read the whole instruction before the feedback note, every
// time. These cover `useInstructionNarration`'s contract directly (the 3 callers' own tests —
// `lesson/ExerciseStep.test.tsx`, `lesson/SeriesBossStep.test.tsx` — cover it end to end).
describe('useInstructionNarration', () => {
  it('speaks the instruction once on mount', async () => {
    const narrator = createFakeNarrator();
    renderHook(() => useInstructionNarration(narrator, 'Tap the rook.', undefined));

    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.']);
    });
  });

  it('a note change speaks only the note, not the instruction again', async () => {
    const narrator = createFakeNarrator();
    const { rerender } = renderHook(
      ({ note }) => useInstructionNarration(narrator, 'Tap the rook.', note),
      { initialProps: { note: undefined as string | undefined } },
    );
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.']);
    });

    rerender({ note: 'Not quite!' });

    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.', 'Not quite!']);
    });
  });

  it('a second note is appended alone too — the instruction is still not repeated', async () => {
    const narrator = createFakeNarrator();
    const { rerender } = renderHook(
      ({ note }) => useInstructionNarration(narrator, 'Tap the rook.', note),
      { initialProps: { note: undefined as string | undefined } },
    );
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.']);
    });

    rerender({ note: 'Not quite!' });
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.', 'Not quite!']);
    });

    rerender({ note: 'Try again.' });
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.', 'Not quite!', 'Try again.']);
    });
  });

  it('an instruction change (e.g. a series-boss round change) speaks the new instruction', async () => {
    const narrator = createFakeNarrator();
    const { rerender } = renderHook(
      ({ instruction }) => useInstructionNarration(narrator, instruction, undefined),
      { initialProps: { instruction: 'Round 1: tap the rook.' } },
    );
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Round 1: tap the rook.']);
    });

    rerender({ instruction: 'Round 2: tap the bishop.' });

    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Round 1: tap the rook.', 'Round 2: tap the bishop.']);
    });
  });

  it('a note arriving while the instruction is still being read waits for it, without cutting it off', async () => {
    // A narrator whose `speak` never resolves on its own (unlike `FakeNarrator`), so the
    // instruction's `speakSequence` run stays pending until the test resolves it by hand.
    let resolveSpeak: (() => void) | undefined;
    let speakCalls = 0;
    let cancelCount = 0;
    const narrator: Narrator = {
      available: true,
      speak() {
        speakCalls += 1;
        return new Promise<void>((resolve) => {
          resolveSpeak = resolve;
        });
      },
      cancel() {
        cancelCount += 1;
      },
    };

    const { rerender } = renderHook(
      ({ note }) => useInstructionNarration(narrator, 'Tap the rook.', note),
      { initialProps: { note: undefined as string | undefined } },
    );
    // Mount: the instruction's own `speak` call, still pending.
    expect(speakCalls).toBe(1);
    expect(cancelCount).toBe(1);

    // A note (e.g. a guided try's auto-shown hint level 1) arrives before the instruction resolves.
    rerender({ note: 'Look at Rhino.' });
    // Not spoken yet, and the instruction was not cancelled or restarted to make room for it.
    expect(speakCalls).toBe(1);
    expect(cancelCount).toBe(1);

    resolveSpeak?.();

    // Only once the instruction's run settles does the note get its own `speakSequence` call.
    await waitFor(() => {
      expect(speakCalls).toBe(2);
    });
    expect(cancelCount).toBe(2);
  });

  it('replay speaks the instruction and current note together, from the top', async () => {
    const narrator = createFakeNarrator();
    const { result, rerender } = renderHook(
      ({ note }) => useInstructionNarration(narrator, 'Tap the rook.', note),
      { initialProps: { note: undefined as string | undefined } },
    );
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.']);
    });
    rerender({ note: 'Not quite!' });
    await waitFor(() => {
      expect(narrator.spoken).toEqual(['Tap the rook.', 'Not quite!']);
    });

    result.current();

    await waitFor(() => {
      expect(narrator.spoken.slice(-2)).toEqual(['Tap the rook.', 'Not quite!']);
    });
  });

  it('replay while a note waits on the instruction: the waiting note does not cut the replay off', async () => {
    // Like the real narrators: `speak` settles when its text ends, or early on `cancel`.
    const spoken: string[] = [];
    let pending: (() => void)[] = [];
    const settleAll = (): void => {
      const settling = pending;
      pending = [];
      for (const settle of settling) settle();
    };
    const narrator: Narrator = {
      available: true,
      speak(text: string) {
        spoken.push(text);
        return new Promise<void>((resolve) => {
          pending.push(resolve);
        });
      },
      cancel: settleAll,
    };

    const { result, rerender } = renderHook(
      ({ note }) => useInstructionNarration(narrator, 'Tap the rook.', note),
      { initialProps: { note: undefined as string | undefined } },
    );
    rerender({ note: 'Look at Rhino.' }); // waits: the instruction is still being read
    expect(spoken).toEqual(['Tap the rook.']);

    result.current(); // "Say it again" supersedes (settles) the instruction run
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The replayed instruction is still playing: the note must not have started over it.
    expect(spoken).toEqual(['Tap the rook.', 'Tap the rook.']);
    settleAll(); // the replayed instruction ends → the replay goes on to its note
    await waitFor(() => {
      expect(spoken).toEqual(['Tap the rook.', 'Tap the rook.', 'Look at Rhino.']);
    });
    settleAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spoken).toEqual(['Tap the rook.', 'Tap the rook.', 'Look at Rhino.']); // nothing extra
  });
});
