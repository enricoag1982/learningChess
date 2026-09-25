import type { BackupFileWriter } from '@chess-kids/core';

export interface FakeBackupFileWriter extends BackupFileWriter {
  /** Every file written so far, oldest first. */
  readonly writes: readonly { readonly filename: string; readonly contents: string }[];
}

/** `BackupFileWriter` fake for tests: records writes instead of touching the DOM. */
export function createFakeBackupFileWriter(): FakeBackupFileWriter {
  const writes: { readonly filename: string; readonly contents: string }[] = [];
  return {
    writes,
    write(filename: string, contents: string): Promise<void> {
      writes.push({ filename, contents });
      return Promise.resolve();
    },
  };
}
