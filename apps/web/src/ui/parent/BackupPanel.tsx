import { useRef, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackupFile } from '@chess-kids/core';
import { BackupValidationError, exportBackup, parseBackupFile } from '@chess-kids/core/backup';
import type { ChildImportChoice, ImportChangeSummary, ImportPlan } from '@chess-kids/core/merge';
import { importMerged, planImport, previewChildChange } from '@chess-kids/core/merge';
import { useServices } from '../../app/store.ts';
import { sendBackupToOtherDevice } from '../../adapters/share-backup.ts';
import { ChevronLeftIcon } from './parent-icons.tsx';
import {
  PARENT_INFO_PANEL,
  PARENT_INPUT,
  PARENT_NOTE,
  PARENT_PRIMARY_BUTTON,
  PARENT_SECONDARY_BUTTON,
} from './parent-styles.ts';

/** Reads a browser `File` as text (`FileReader`, wrapped as a promise). */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('failed to read file'));
    };
    reader.readAsText(file);
  });
}

const ADD_NEW = 'add-new';

/** A `<select>` option's `value`: `ADD_NEW`, or the local profile id to merge into. */
function choiceToSelectValue(choice: ChildImportChoice): string {
  return choice.kind === 'add-new' ? ADD_NEW : (choice.localProfileId ?? ADD_NEW);
}

function selectValueToChoice(incomingProfileId: string, value: string): ChildImportChoice {
  return value === ADD_NEW
    ? { incomingProfileId, kind: 'add-new' }
    : { incomingProfileId, kind: 'merge', localProfileId: value };
}

interface PendingImport {
  readonly raw: string;
  readonly incomingFile: BackupFile;
  readonly plan: ImportPlan;
  /** By incoming profile id — every non-auto-merge child's current choice (auto-merge children have
   * no entry: `importMerged` always merges them regardless, decision table "no question"). */
  readonly choices: Readonly<Record<string, ChildImportChoice>>;
  /** By incoming profile id — the change summary for that child's *current* choice, recomputed
   * whenever it changes (`refreshChange`). Loads in as each one resolves, so the preview never
   * blocks on every child at once. */
  readonly changes: Readonly<Record<string, ImportChangeSummary>>;
}

export interface BackupScreenProps {
  readonly onBack: () => void;
  /** Called once an import has merged in new data — the caller refreshes its own profile list. */
  readonly onImported: () => void;
}

/**
 * Parent area "Backup" (M7.2 device sharing, app-structure.md §11, §13 "Across devices"): export
 * every child's data as one JSON file; "Send to other device" via the share sheet (falls back to a
 * download); pick a file to preview and merge it in — per incoming child, "Merge into ‹local
 * child›" (auto, silent, when its id already matches one) or a choice between that and "Add as new
 * child". Nothing already on this device is ever lost or replaced.
 */
export function BackupScreen({ onBack, onImported }: BackupScreenProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  async function exportAll(): Promise<void> {
    setExporting(true);
    await exportBackup(services.deps);
    setExporting(false);
  }

  async function shareAll(): Promise<void> {
    setSharing(true);
    setShareNote(null);
    const outcome = await sendBackupToOtherDevice(services.deps);
    if (outcome === 'shared') setShareNote(t('parent.backup.share-shared'));
    if (outcome === 'downloaded')
      setShareNote(t('parent.backup.share-downloaded', { location: 'Downloads' }));
    // 'cancelled': silent, no note (decision table "A user cancel is silent").
    setSharing(false);
  }

  async function refreshChange(next: PendingImport, incomingProfileId: string): Promise<void> {
    const choice = next.choices[incomingProfileId];
    if (choice === undefined) return; // auto-merge child: nothing to preview a choice for.
    const summary = await previewChildChange(services.deps, next.incomingFile, choice);
    setPending((current) => {
      if (current === null || current.incomingFile !== next.incomingFile) return current;
      return { ...current, changes: { ...current.changes, [incomingProfileId]: summary } };
    });
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError(null);
    setDone(false);
    try {
      const raw = await readFileText(file);
      const incomingFile = parseBackupFile(services.deps, raw);
      const plan = await planImport(services.deps, incomingFile);
      const choices: Record<string, ChildImportChoice> = {};
      for (const child of plan.children) {
        if (!child.autoMerge) choices[child.incomingProfile.id] = child.defaultChoice;
      }
      const next: PendingImport = { raw, incomingFile, plan, choices, changes: {} };
      setPending(next);
      for (const incomingProfileId of Object.keys(choices)) {
        void refreshChange(next, incomingProfileId);
      }
    } catch (caught: unknown) {
      setPending(null);
      setError(
        caught instanceof BackupValidationError
          ? caught.message
          : t('parent.backup.import-error-generic'),
      );
    }
  }

  function onChoiceChange(incomingProfileId: string, value: string): void {
    setPending((current) => {
      if (current === null) return current;
      const choice = selectValueToChoice(incomingProfileId, value);
      const next: PendingImport = {
        ...current,
        choices: { ...current.choices, [incomingProfileId]: choice },
      };
      void refreshChange(next, incomingProfileId);
      return next;
    });
  }

  async function confirmImport(): Promise<void> {
    if (!pending) return;
    setImporting(true);
    try {
      await importMerged(services.deps, pending.incomingFile, Object.values(pending.choices));
      setPending(null);
      setDone(true);
      onImported();
    } catch {
      setError(t('parent.backup.import-error-generic'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('parent.back')}
          className="tap-raised flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-card text-ink"
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="flex-1 text-base font-extrabold text-ink">{t('parent.backup-title')}</h2>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.backup.share-heading')}</h3>
        <p className="text-sm text-muted">{t('parent.backup.share-body')}</p>
        <button
          type="button"
          disabled={sharing}
          onClick={() => {
            void shareAll();
          }}
          className={`${PARENT_PRIMARY_BUTTON} self-start`}
        >
          {t('parent.backup.share-button')}
        </button>
        {shareNote && <p className={PARENT_NOTE}>{shareNote}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.backup.export-heading')}</h3>
        <p className="text-sm text-muted">{t('parent.backup.export-body')}</p>
        <button
          type="button"
          disabled={exporting}
          onClick={() => {
            void exportAll();
          }}
          className={`${PARENT_SECONDARY_BUTTON} self-start`}
        >
          {t('parent.backup.export-button')}
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.backup.import-heading')}</h3>
        <p className="text-sm text-muted">{t('parent.backup.import-body')}</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          aria-label={t('parent.backup.import-pick-file')}
          className="hidden"
          onChange={(event) => {
            void onFileSelected(event);
          }}
        />
        <button
          type="button"
          onClick={() => {
            fileInputRef.current?.click();
          }}
          className={`${PARENT_SECONDARY_BUTTON} self-start`}
        >
          {t('parent.backup.import-pick-file')}
        </button>

        {error && <p className={PARENT_NOTE}>{error}</p>}

        {pending && (
          <div className={`${PARENT_INFO_PANEL} flex flex-col gap-3`}>
            <p className="text-sm font-bold text-ink">
              {t('parent.backup.import-preview', { count: pending.plan.children.length })}
            </p>

            <ul className="flex flex-col gap-3">
              {pending.plan.children.map((child) => {
                const incomingId = child.incomingProfile.id;
                const change = pending.changes[incomingId];
                return (
                  <li key={incomingId} className="flex flex-col gap-1">
                    {child.autoMerge ? (
                      <p className="text-sm text-ink">
                        {t('parent.backup.import-child-auto-merge', {
                          name: child.incomingProfile.nickname,
                        })}
                      </p>
                    ) : (
                      <select
                        aria-label={t('parent.backup.import-child-choice-label', {
                          name: child.incomingProfile.nickname,
                        })}
                        value={choiceToSelectValue(
                          pending.choices[incomingId] ?? child.defaultChoice,
                        )}
                        onChange={(event) => {
                          onChoiceChange(incomingId, event.target.value);
                        }}
                        className={PARENT_INPUT}
                      >
                        <option value={ADD_NEW}>{t('parent.backup.import-child-add-new')}</option>
                        {child.localProfiles.map((localProfile) => (
                          <option key={localProfile.id} value={localProfile.id}>
                            {t('parent.backup.import-child-merge-into', {
                              name: localProfile.nickname,
                            })}
                          </option>
                        ))}
                      </select>
                    )}
                    {change && (
                      <p className="text-sm text-muted">
                        {t('parent.backup.import-child-change', {
                          stars: change.starsDelta,
                          badges: change.badgesDelta,
                          minutes: change.minutesThisWeekDelta,
                        })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className={PARENT_NOTE}>{t('parent.backup.import-warning')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  void confirmImport();
                }}
                className={PARENT_PRIMARY_BUTTON}
              >
                {t('parent.backup.import-confirm')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                }}
                className={PARENT_SECONDARY_BUTTON}
              >
                {t('parent.cancel')}
              </button>
            </div>
          </div>
        )}

        {done && <p className={PARENT_NOTE}>{t('parent.backup.import-done')}</p>}
      </section>
    </div>
  );
}
