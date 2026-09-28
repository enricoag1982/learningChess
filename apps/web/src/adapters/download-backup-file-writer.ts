import type { BackupFileWriter } from '@learn/platform-core';

/** Triggers a same-origin download of `filename` holding `text`, then releases the object URL.
 * Exported so `share-backup.ts`'s fallback can reuse it directly. */
export function triggerDownload(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
