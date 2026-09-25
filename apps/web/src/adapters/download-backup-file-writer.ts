import type { BackupFileWriter } from '@chess-kids/core';

/** Triggers a same-origin download of `filename` holding `text`, then releases the object URL
 * (same mechanism `download-password-file-writer.ts` uses). */
function triggerDownload(filename: string, text: string): void {
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

/**
 * `BackupFileWriter` for the web (M5.1, `docs/app-structure.md` §11): browsers cannot write to a
 * fixed path, so this downloads the backup JSON to the browser's Downloads folder — a Capacitor
 * adapter can later write to Documents instead, same reasoning `PasswordFileWriter` documents.
 */
export function createDownloadBackupFileWriter(): BackupFileWriter {
  return {
    write(filename: string, contents: string): Promise<void> {
      triggerDownload(filename, contents);
      return Promise.resolve();
    },
  };
}
