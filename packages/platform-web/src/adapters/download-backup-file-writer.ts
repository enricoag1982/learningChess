import type { BackupFileWriter } from '@learn/platform-core';
import { triggerDownload } from './download.ts';

/** `BackupFileWriter` for the web (`docs/app-structure.md` §11): downloads the backup JSON to the
 * browser's Downloads folder. */
export function createDownloadBackupFileWriter(): BackupFileWriter {
  return {
    write(filename: string, contents: string): Promise<void> {
      triggerDownload(filename, contents);
      return Promise.resolve();
    },
  };
}
