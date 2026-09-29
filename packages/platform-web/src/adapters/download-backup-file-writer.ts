import type { BackupFileWriter } from '@learn/platform-core';
import { triggerDownload } from './download.ts';

/** Downloads the backup JSON to the browser's Downloads folder (`docs/app-structure.md` §11). */
export function createDownloadBackupFileWriter(): BackupFileWriter {
  return {
    write(filename: string, contents: string): Promise<void> {
      triggerDownload(filename, contents);
      return Promise.resolve();
    },
  };
}
