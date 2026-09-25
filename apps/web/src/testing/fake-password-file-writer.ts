import type { PasswordFileWriter } from '@chess-kids/core';

const LOCATION = 'Downloads/chess-for-kids-parent-code.txt';

export interface FakePasswordFileWriter extends PasswordFileWriter {
  /** Every password written so far, oldest first. */
  readonly writes: readonly string[];
}

/** `PasswordFileWriter` fake for tests: records writes instead of touching the DOM. */
export function createFakePasswordFileWriter(): FakePasswordFileWriter {
  const writes: string[] = [];
  return {
    writes,
    write(password: string): Promise<{ location: string }> {
      writes.push(password);
      return Promise.resolve({ location: LOCATION });
    },
  };
}
