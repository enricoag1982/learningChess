import type { PasswordFileWriter } from '@learn/platform-core';
import { triggerDownload } from './download.ts';

function fileText(password: string): string {
  return `Chess for Kids — parent code: ${password}\nKeep this file. The app asks for this code before the grown-ups area.\n`;
}

/** `PasswordFileWriter` for the web: browsers cannot write to a fixed path, so this downloads a
 * plain-text copy of the password to Downloads instead (app-structure.md §2). `filePrefix` is
 * `AppConfig.parentCodeFilePrefix`. */
export function createDownloadPasswordFileWriter(filePrefix: string): PasswordFileWriter {
  const fileName = `${filePrefix}.txt`;
  const location = `Downloads/${fileName}`;
  return {
    write(password: string): Promise<{ location: string }> {
      triggerDownload(fileName, fileText(password), 'text/plain');
      return Promise.resolve({ location });
    },
  };
}
