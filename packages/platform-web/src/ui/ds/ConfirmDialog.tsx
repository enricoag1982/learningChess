import type { JSX } from 'react';
import { tapClass } from './tap.ts';

export interface ConfirmDialogProps {
  readonly title: string;
  /** The visible line, when different from `title` (which is always the dialog's `aria-label`,
   * never rendered on its own otherwise). */
  readonly message?: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly confirmTone: 'go' | 'today';
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Kid-style yes/no confirm (take-back ask, stop-game): `role="alertdialog"`, `aria-label` = `title`. */
export function ConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmTone,
  onCancel,
  onConfirm,
}: ConfirmDialogProps): JSX.Element {
  return (
    <div
      role="alertdialog"
      aria-label={title}
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-line bg-card p-6 text-center">
        <p className="font-display text-xl text-ink">{message ?? title}</p>
        <div className="flex w-full gap-3">
          <button type="button" onClick={onCancel} className={tapClass('dialog')}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={tapClass('dialog', confirmTone)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
