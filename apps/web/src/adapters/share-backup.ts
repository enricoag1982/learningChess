import type { AppDeps } from '@learn/platform-core';
import { buildShareFile } from '@learn/platform-core/backup';
import { triggerDownload } from './download-backup-file-writer.ts';

/** Outcome of {@link sendBackupToOtherDevice}: `cancelled` shows no error UI (a user cancel is
 * silent). */
export type ShareBackupOutcome = 'shared' | 'downloaded' | 'cancelled';

/** `true` when this browser can share `file` via the Web Share API; feature-checked since Safari
 * 15.4 has neither `navigator.share` nor `canShare`. */
function canShareFile(file: File): boolean {
  const canShare = (navigator as Partial<Navigator>).canShare;
  return typeof canShare === 'function' && canShare.call(navigator, { files: [file] });
}

/** Parent area "Send to other device": builds the backup JSON and offers it through the Web Share
 * API (OS share sheet) when available, else falls back to a same-origin download. `profileIds:
 * [id]` shares just that one child; omitted shares every child. */
export async function sendBackupToOtherDevice(
  deps: AppDeps,
  profileIds?: readonly string[],
): Promise<ShareBackupOutcome> {
  const { filename, contents } = await buildShareFile(deps, profileIds);
  const share = (navigator as Partial<Navigator>).share;
  const file = new File([contents], filename, { type: 'application/json' });

  if (typeof share === 'function' && canShareFile(file)) {
    try {
      await share.call(navigator, { files: [file], title: filename });
      return 'shared';
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      // Any other share error (e.g. the OS sheet itself failing) falls back to download below.
    }
  }

  triggerDownload(filename, contents);
  return 'downloaded';
}
