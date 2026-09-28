import type { PasswordFileWriter } from '@learn/platform-core';

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

/** `PasswordFileWriter` for the web: browsers cannot write to a fixed path, so this downloads a
 * plain-text copy of the password to Downloads instead (app-structure.md §2). `filePrefix` is
 * `AppConfig.parentCodeFilePrefix`. */
export function createDownloadPasswordFileWriter(filePrefix: string): PasswordFileWriter {
  const fileName = `${filePrefix}.txt`;
  const location = `Downloads/${fileName}`;
  return {
    write(password: string): Promise<{ location: string }> {
      triggerDownload(fileName, fileText(password));
      return Promise.resolve({ location });
    },
  };
}
