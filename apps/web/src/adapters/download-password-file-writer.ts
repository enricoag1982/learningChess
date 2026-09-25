import type { PasswordFileWriter } from '@chess-kids/core';

const FILE_NAME = 'chess-for-kids-parent-code.txt';
/** app-structure.md §2: web keeps the password in the app; this file is only the parent's copy. */
const LOCATION = `Downloads/${FILE_NAME}`;

function fileText(password: string): string {
  return `Chess for Kids — parent code: ${password}\nKeep this file. The app asks for this code before the grown-ups area.\n`;
}

/** Triggers a same-origin download of `filename` holding `text`, then releases the object URL. */
function triggerDownload(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
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
 * `PasswordFileWriter` for the web: browsers cannot write to a fixed path, so this downloads a
 * plain-text copy of the password to the browser's Downloads folder instead (app-structure.md §2:
 * "copy saved as `Downloads/chess-for-kids-parent-code.txt` at setup, at every change and on
 * \"Download code file\" in the grown-ups area").
 */
export function createDownloadPasswordFileWriter(): PasswordFileWriter {
  return {
    write(password: string): Promise<{ location: string }> {
      triggerDownload(FILE_NAME, fileText(password));
      return Promise.resolve({ location: LOCATION });
    },
  };
}
