import type { AppDeps } from '@chess-kids/core';
import { buildShareFile } from '@chess-kids/core/backup';
import { triggerDownload } from './download-backup-file-writer.ts';

/** Outcome of {@link sendBackupToOtherDevice} — distinguishes a silent user cancel from every other
 * outcome, so the caller shows no error UI for a cancel (decision table "A user cancel (AbortError)
 * is silent"). */
export type ShareBackupOutcome = 'shared' | 'downloaded' | 'cancelled';

/** `true` when this browser can share `file` via the Web Share API — both `navigator.share` and
 * `navigator.canShare` are feature-checked as functions before ever being called (non-functional.md
 * §4: minimum Safari 15.4, which has neither), and `canShare` itself is the browser's own answer for
 * *this* file (some browsers support text/url sharing but not files). */
function canShareFile(file: File): boolean {
  const canShare = (navigator as Partial<Navigator>).canShare;
  return typeof canShare === 'function' && canShare.call(navigator, { files: [file] });
}

/**
 * Parent area "Send to other device" (M7.2 device sharing, decision table "Send to other device"):
 * builds the same backup JSON the Export button writes, under a `chess-for-kids-<nickname or
 * all>-<date>.json` name (`buildShareFile`), and offers it through the Web Share API
 * (`navigator.share({ files: [file], title })`) when this browser can share files — the OS share
 * sheet (AirDrop / Messages / Drive / …) then lets the parent hand it to the other device. Falls
 * back to a same-origin download (`triggerDownload`, the same mechanism the Export button uses)
 * when file sharing is unavailable, or when the share itself fails for any reason other than the
 * parent cancelling (`AbortError`, left silent — never a fallback download after a deliberate
 * cancel). `profileIds: [id]` shares just that one child; omitted shares every child.
 */
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
