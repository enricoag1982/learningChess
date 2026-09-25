import { useRef, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackupFile } from '@chess-kids/core';
import {
  backupSummary,
  BackupValidationError,
  exportBackup,
  importBackup,
  parseBackupFile,
} from '@chess-kids/core/backup';
import { useServices } from '../../app/store.ts';
import { ChevronLeftIcon } from './parent-icons.tsx';
import {
  PARENT_DANGER_BUTTON,
  PARENT_INFO_PANEL,
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

export interface BackupScreenProps {
  readonly onBack: () => void;
  /** Called once an import has replaced all local data — the caller refreshes its own profile list. */
  readonly onImported: () => void;
}

/** Parent area "Backup" (app-structure.md §11, non-functional.md §5): export every child's data as
 * one JSON file, or pick a file to preview and (after confirming) import — replacing all local
 * data ("never partial"; an invalid file shows a clear error and changes nothing). */
export function BackupScreen({ onBack, onImported }: BackupScreenProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<{
    readonly raw: string;
    readonly file: BackupFile;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  async function exportAll(): Promise<void> {
    setExporting(true);
    await exportBackup(services.deps);
    setExporting(false);
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
      const parsed = parseBackupFile(services.deps, raw);
      setPending({ raw, file: parsed });
    } catch (caught: unknown) {
      setPending(null);
      setError(
        caught instanceof BackupValidationError
          ? caught.message
          : t('parent.backup.import-error-generic'),
      );
    }
  }

  async function confirmImport(): Promise<void> {
    if (!pending) return;
    setImporting(true);
    try {
      await importBackup(services.deps, pending.raw);
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
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="flex-1 text-base font-extrabold text-ink">{t('parent.backup-title')}</h2>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.backup.export-heading')}</h3>
        <p className="text-sm text-muted">{t('parent.backup.export-body')}</p>
        <button
          type="button"
          disabled={exporting}
          onClick={() => {
            void exportAll();
          }}
          className={`${PARENT_PRIMARY_BUTTON} self-start`}
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
              {t('parent.backup.import-preview', {
                count: backupSummary(pending.file).profileCount,
                totalStars: backupSummary(pending.file).totalStars,
              })}
            </p>
            <p className="text-sm text-muted">
              {t('parent.backup.import-preview-detail', {
                names: pending.file.profiles.map((profile) => profile.nickname).join(', '),
              })}
            </p>
            <p className={PARENT_NOTE}>{t('parent.backup.import-warning')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  void confirmImport();
                }}
                className={PARENT_DANGER_BUTTON}
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
