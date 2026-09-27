import type { JSX, ReactNode, SubmitEvent } from 'react';
import { PARENT_DANGER_BUTTON, PARENT_SECONDARY_BUTTON } from '../parent/parent-styles.ts';

/**
 * Parent-only pieces (lazy chunks only, refactor-v4.md §4 "Initial JS must not grow"): imported
 * only from the parent area's own screens, never eagerly.
 */

export interface ParentConfirmDialogProps {
  readonly title: string;
  readonly body: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  /** Plain confirm (delete): called directly. Password re-entry (reset) passes `onSubmit`
   * instead — this then renders a `<form>` so Enter submits it, same as before. */
  readonly onConfirm?: () => void;
  readonly onSubmit?: (event: SubmitEvent<HTMLFormElement>) => void;
  readonly confirmDisabled?: boolean;
  /** Extra content between the body text and the button row (the reset flow's password field). */
  readonly children?: ReactNode;
}

/** A parent-style confirm dialog (`role="dialog"`) — replaces the 2 near-identical shells in
 * ChildSettings.tsx (delete profile, reset progress's own password re-entry). */
export function ParentConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  onSubmit,
  confirmDisabled,
  children,
}: ParentConfirmDialogProps): JSX.Element {
  const content = (
    <>
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      {children}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={PARENT_SECONDARY_BUTTON}>
          {cancelLabel}
        </button>
        <button
          type={onSubmit ? 'submit' : 'button'}
          onClick={onSubmit ? undefined : onConfirm}
          disabled={confirmDisabled}
          className={PARENT_DANGER_BUTTON}
        >
          {confirmLabel}
        </button>
      </div>
    </>
  );
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
    >
      {onSubmit ? (
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-card p-6"
        >
          {content}
        </form>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-card p-6">{content}</div>
      )}
    </div>
  );
}
