import type { JSX, ReactNode, SubmitEvent } from 'react';
import { PARENT_SECONDARY_BUTTON } from '../parent/parent-styles.ts';
import { PARENT_DANGER_BUTTON } from './parent-styles-lazy.ts';

/** Parent-only pieces (lazy chunks only): imported only from parent-area screens, never eagerly.
 * Style constants live in `parent-styles-lazy.ts`, so this file stays component-exports-only. */

const SECTION_GAP: Readonly<Record<3 | 4, string>> = { 3: 'gap-3', 4: 'gap-4' };

export interface ParentSectionProps {
  /** Omitted where the section has no heading of its own (nested `<h3>`s, or none at all). */
  readonly title?: string;
  readonly gap?: 3 | 4;
  readonly children: ReactNode;
}

export function ParentSection({ title, gap = 3, children }: ParentSectionProps): JSX.Element {
  return (
    <section
      className={`flex flex-col ${SECTION_GAP[gap]} rounded-xl border border-line bg-card p-4`}
    >
      {title !== undefined && <h3 className="text-sm font-extrabold text-ink">{title}</h3>}
      {children}
    </section>
  );
}

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
  readonly children?: ReactNode;
}

/** A parent-style confirm dialog (`role="dialog"`), shared by delete-profile and reset-progress (password re-entry). */
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
