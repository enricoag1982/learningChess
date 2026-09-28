import { useEffect, useRef, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameRecord, PieceStyleSetting, Profile, ProfileSettings } from '@chess-kids/core';
import type { Journey } from '@chess-kids/core/chess';
import type { Services } from '../../app/services.ts';
import {
  changeAvatar,
  DAILY_LIMIT_OPTIONS,
  deleteProfile,
  getProfileSettings,
  loadJourney,
  PLAY_FROM_OPTIONS,
  PLAY_UNTIL_OPTIONS,
  renameProfile,
  resetProfileData,
  updateProfileSettings,
  validateNickname,
  verifyParentPassword,
} from '@chess-kids/core';
import { computerLevelStatus, loadGameRecords } from '@chess-kids/core/chess';
import { exportBackup } from '@chess-kids/core/backup';
import { useAppStore, useServices } from '../../app/store.ts';
import { sendBackupToOtherDevice } from '../../adapters/share-backup.ts';
import { AVATARS, avatarBackground } from '../art/avatar-meta.ts';
import { AvatarIcon } from '../art/avatars.tsx';
import { ChevronLeftIcon } from '../ds/icons-lazy.tsx';
import { tapClass } from '../ds/tap.ts';
import { ScreenHeader } from '../ds/Screen.tsx';
import { ParentConfirmDialog, ParentSection } from '../ds/parent.tsx';
import {
  PARENT_CHIP,
  PARENT_CHIP_LOCKED,
  PARENT_CHIP_SELECTED,
  PARENT_DANGER_BUTTON,
} from '../ds/parent-styles-lazy.ts';
import { AvatarBadge } from '../ds/AvatarBadge.tsx';
import {
  PARENT_INPUT,
  PARENT_NOTE,
  PARENT_PRIMARY_BUTTON,
  PARENT_SECONDARY_BUTTON,
} from './parent-styles.ts';
import { UnlockPanel } from './UnlockPanel.tsx';

/** Small inline avatar picker (parent style, ≥ 44px targets). */
function AvatarPicker({ onPick }: { readonly onPick: (avatar: string) => void }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {AVATARS.map((id) => (
        <button
          key={id}
          type="button"
          aria-label={id}
          onClick={() => {
            onPick(id);
          }}
          className={tapClass(
            'custom',
            'none',
            'flex h-11 w-11 items-center justify-center overflow-hidden rounded-full p-1.5',
          )}
          style={{ backgroundColor: avatarBackground(id) }}
        >
          <AvatarIcon avatar={id} />
        </button>
      ))}
    </div>
  );
}

/** A parent password re-entry dialog, for a dangerous action (Reset). */
function PasswordConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirmed,
}: {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  readonly onConfirmed: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    const result = await verifyParentPassword(services.deps, password);
    setBusy(false);
    if (!result.ok) {
      setError(t('parent.wrong-password'));
      return;
    }
    onConfirmed();
  }

  return (
    <ParentConfirmDialog
      title={title}
      body={body}
      cancelLabel={t('parent.cancel')}
      confirmLabel={confirmLabel}
      onCancel={onCancel}
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      confirmDisabled={busy}
    >
      <label className="flex flex-col gap-1 text-sm font-bold text-ink">
        {t('parent.password-label')}
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          className={PARENT_INPUT}
          autoComplete="current-password"
          autoFocus
        />
      </label>
      {error && <p className={PARENT_NOTE}>{error}</p>}
    </ParentConfirmDialog>
  );
}

function DeleteConfirmDialog({
  profile,
  onCancel,
  onConfirm,
}: {
  readonly profile: Profile;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <ParentConfirmDialog
      title={t('parent.delete-confirm-title', { name: profile.nickname })}
      body={t('parent.delete-confirm-body')}
      cancelLabel={t('parent.delete-cancel')}
      confirmLabel={t('parent.delete-confirm')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

/** One {@link DAILY_LIMIT_OPTIONS} chip row (reused for "Every day" / "Mon–Fri" / "Sat–Sun"). */
function LimitChipRow({
  label,
  value,
  onPick,
}: {
  readonly label: string;
  readonly value: number | null;
  readonly onPick: (value: number | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-extrabold tracking-wide text-muted uppercase">{label}</h4>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {DAILY_LIMIT_OPTIONS.map((option) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={value === option}
            onClick={() => {
              onPick(option);
            }}
            className={value === option ? PARENT_CHIP_SELECTED : PARENT_CHIP}
          >
            {option === null
              ? t('parent.daily-limit-off')
              : t('parent.daily-limit-minutes', { count: option })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One allowed-hours chip row ("Play until"/"Not before"): `options` are `'HH:MM'` strings shown
 * as-is, plus `null` for "off". */
function HoursChipRow({
  label,
  options,
  value,
  onPick,
}: {
  readonly label: string;
  readonly options: readonly (string | null)[];
  readonly value: string | null;
  readonly onPick: (value: string | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold text-ink">{label}</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={value === option}
            onClick={() => {
              onPick(option);
            }}
            className={value === option ? PARENT_CHIP_SELECTED : PARENT_CHIP}
          >
            {option === null ? t('parent.daily-limit-off') : option}
          </button>
        ))}
      </div>
    </div>
  );
}

type VoiceOutcome = Awaited<ReturnType<Services['testVoice']>>;

/** Parent area "Test voice" check: speaks one fixed sentence through the real narrator and reports
 * whether generated audio played, or a short reason why it fell back (`docs/voice.md`). */
function VoiceTestRow(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [testing, setTesting] = useState(false);
  const [outcome, setOutcome] = useState<VoiceOutcome | null>(null);

  async function runTest(): Promise<void> {
    setTesting(true);
    const result = await services.testVoice(t('voice-check.sentence'));
    setOutcome(result);
    setTesting(false);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={testing}
        onClick={() => {
          void runTest();
        }}
        className={PARENT_SECONDARY_BUTTON}
      >
        {t('parent.voice-test-button')}
      </button>
      {outcome &&
        (outcome.kind === 'audio' ? (
          <p className="text-sm font-bold text-muted">{t('parent.voice-test-audio')}</p>
        ) : (
          <p className={PARENT_NOTE}>
            {t('parent.voice-test-fallback', {
              reason: t(`parent.voice-test-reason.${outcome.reason}`),
            })}
          </p>
        ))}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className={tapClass(
        'custom',
        'none',
        'flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-card px-4 py-2 text-left',
      )}
    >
      <span className="text-sm font-bold text-ink">{label}</span>
      <span
        className={`flex h-7 w-12 flex-shrink-0 items-center rounded-full p-1 transition-colors ${checked ? 'bg-go' : 'bg-[#D8D2C4]'}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}

export interface ChildSettingsScreenProps {
  readonly profile: Profile;
  readonly onBack: () => void;
  readonly onDeleted: () => void;
}

/** Parent area "child settings" (app-structure.md §11): rename/avatar/delete, per-child settings,
 * unlock lessons & worlds, export, reset. Daily limit is enforced live; the rest next profile select. */
export function ChildSettingsScreen({
  profile,
  onBack,
  onDeleted,
}: ChildSettingsScreenProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);

  const [nickname, setNickname] = useState(profile.nickname);
  const [renaming, setRenaming] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [gameRecords, setGameRecords] = useState<readonly GameRecord[]>([]);

  // No effect resyncing `nickname`: the caller remounts this with `key={profile.id}` per child.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getProfileSettings(services.deps, profile.id),
      loadJourney(services.deps, profile.id),
      loadGameRecords(services.deps, profile.id),
    ]).then(([loadedSettings, loadedJourney, loadedRecords]) => {
      if (cancelled) return;
      setSettings(loadedSettings);
      setJourney(loadedJourney);
      setGameRecords(loadedRecords);
    });
    return () => {
      cancelled = true;
    };
  }, [services, profile.id]);

  async function submitRename(): Promise<void> {
    if (!validateNickname(nickname)) {
      setNicknameError(t('new-player.nickname.invalid'));
      return;
    }
    await renameProfile(services.deps, profile.id, nickname);
    setNicknameError(null);
    setRenaming(false);
    await refreshProfiles();
  }

  async function pickAvatar(avatar: string): Promise<void> {
    await changeAvatar(services.deps, profile.id, avatar);
    setPickingAvatar(false);
    await refreshProfiles();
  }

  // Queues patches (up to four chip rows a parent could tap in quick succession): each
  // read-merge-save call races on the stored settings otherwise, silently dropping a field.
  const patchQueueRef = useRef<Promise<void>>(Promise.resolve());

  async function patchSettings(patch: Partial<ProfileSettings>): Promise<void> {
    const run = patchQueueRef.current.then(async () => {
      const updated = await updateProfileSettings(services.deps, profile.id, patch);
      setSettings(updated);
    });
    // The queue must never reject, or every later patch would wedge behind it.
    patchQueueRef.current = run.catch(() => undefined);
    await run;
  }

  async function confirmDelete(): Promise<void> {
    await deleteProfile(services.deps, profile.id);
    setConfirmingDelete(false);
    await refreshProfiles();
    onDeleted();
  }

  async function confirmReset(): Promise<void> {
    await resetProfileData(services.deps, profile.id);
    setConfirmingReset(false);
    setResetDone(true);
  }

  async function exportThisChild(): Promise<void> {
    setExporting(true);
    await exportBackup(services.deps, [profile.id]);
    setExporting(false);
  }

  async function shareThisChild(): Promise<void> {
    setSharing(true);
    setShareNote(null);
    const outcome = await sendBackupToOtherDevice(services.deps, [profile.id]);
    if (outcome === 'shared') setShareNote(t('parent.backup.share-shared'));
    if (outcome === 'downloaded')
      setShareNote(t('parent.backup.share-downloaded', { location: 'Downloads' }));
    // 'cancelled': silent, no note (decision table "A user cancel is silent").
    setSharing(false);
  }

  const levelStatuses = journey ? computerLevelStatus(gameRecords, journey) : [];

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        look="parent"
        action="back"
        actionLabel={t('parent.back')}
        onAction={onBack}
        icon={<ChevronLeftIcon />}
        title={t('parent.settings-title', { name: profile.nickname })}
      />

      <ParentSection>
        <div className="flex items-center gap-3">
          <AvatarBadge
            avatar={profile.avatar}
            className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full p-1.5"
          />
          {renaming ? (
            <input
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
              }}
              className={`${PARENT_INPUT} flex-1`}
              autoFocus
            />
          ) : (
            <span className="flex-1 text-base font-extrabold text-ink">{profile.nickname}</span>
          )}
        </div>
        {pickingAvatar && (
          <AvatarPicker
            onPick={(avatar) => {
              void pickAvatar(avatar);
            }}
          />
        )}
        {nicknameError && <p className={PARENT_NOTE}>{nicknameError}</p>}
        <div className="flex flex-wrap gap-2">
          {renaming ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void submitRename();
                }}
                className={PARENT_PRIMARY_BUTTON}
              >
                {t('parent.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setNickname(profile.nickname);
                  setNicknameError(null);
                }}
                className={PARENT_SECONDARY_BUTTON}
              >
                {t('parent.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNickname(profile.nickname);
                setRenaming(true);
              }}
              className={PARENT_SECONDARY_BUTTON}
            >
              {t('parent.rename')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setPickingAvatar((value) => !value);
            }}
            className={PARENT_SECONDARY_BUTTON}
          >
            {t('parent.change-avatar')}
          </button>
        </div>
      </ParentSection>

      {settings && (
        <ParentSection gap={4}>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-extrabold text-ink">{t('parent.daily-limit-heading')}</h3>
            <ToggleRow
              label={t('parent.weekend-limit-toggle')}
              checked={settings.weekendLimitMinutes !== undefined}
              onChange={(enabled) => {
                void patchSettings({
                  weekendLimitMinutes: enabled ? settings.dailyLimitMinutes : undefined,
                });
              }}
            />
            {settings.weekendLimitMinutes !== undefined ? (
              <>
                <LimitChipRow
                  label={t('parent.daily-limit-weekday')}
                  value={settings.dailyLimitMinutes}
                  onPick={(value) => {
                    void patchSettings({ dailyLimitMinutes: value });
                  }}
                />
                <LimitChipRow
                  label={t('parent.daily-limit-weekend')}
                  value={settings.weekendLimitMinutes}
                  onPick={(value) => {
                    void patchSettings({ weekendLimitMinutes: value });
                  }}
                />
              </>
            ) : (
              <LimitChipRow
                label={t('parent.daily-limit-everyday')}
                value={settings.dailyLimitMinutes}
                onPick={(value) => {
                  void patchSettings({ dailyLimitMinutes: value });
                }}
              />
            )}
            <p className={PARENT_NOTE}>{t('parent.daily-limit-note')}</p>
          </div>

          <HoursChipRow
            label={t('parent.play-until-heading')}
            options={PLAY_UNTIL_OPTIONS}
            value={settings.playUntil ?? null}
            onPick={(value) => {
              void patchSettings({ playUntil: value });
            }}
          />
          <HoursChipRow
            label={t('parent.play-from-heading')}
            options={PLAY_FROM_OPTIONS}
            value={settings.playFrom ?? null}
            onPick={(value) => {
              void patchSettings({ playFrom: value });
            }}
          />

          <ToggleRow
            label={t('parent.voice-label')}
            checked={settings.voice}
            onChange={(value) => {
              void patchSettings({ voice: value });
            }}
          />
          <VoiceTestRow />
          <ToggleRow
            label={t('parent.sound-label')}
            checked={settings.sound}
            onChange={(value) => {
              void patchSettings({ sound: value });
            }}
          />
          <ToggleRow
            label={t('parent.hints-label')}
            checked={settings.hints}
            onChange={(value) => {
              void patchSettings({ hints: value });
            }}
          />

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-extrabold text-ink">
              {t('parent.computer-level-heading')}
            </h3>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('parent.computer-level-heading')}
            >
              <button
                type="button"
                aria-pressed={settings.computerLevel === 'auto'}
                onClick={() => {
                  void patchSettings({ computerLevel: 'auto' });
                }}
                className={settings.computerLevel === 'auto' ? PARENT_CHIP_SELECTED : PARENT_CHIP}
              >
                {t('parent.computer-level-auto')}
              </button>
              {levelStatuses.map((status) => (
                <button
                  key={status.level}
                  type="button"
                  disabled={status.locked}
                  aria-pressed={settings.computerLevel === status.level}
                  onClick={() => {
                    void patchSettings({ computerLevel: status.level });
                  }}
                  className={
                    status.locked
                      ? PARENT_CHIP_LOCKED
                      : settings.computerLevel === status.level
                        ? PARENT_CHIP_SELECTED
                        : PARENT_CHIP
                  }
                >
                  {t(`boss.versus.bot-name.${status.name}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-extrabold text-ink">{t('parent.piece-style-heading')}</h3>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('parent.piece-style-heading')}
            >
              {(['animal', 'classic'] satisfies PieceStyleSetting[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={settings.pieceStyle === style}
                  onClick={() => {
                    void patchSettings({ pieceStyle: style });
                  }}
                  className={settings.pieceStyle === style ? PARENT_CHIP_SELECTED : PARENT_CHIP}
                >
                  {t(`parent.piece-style-${style}`)}
                </button>
              ))}
            </div>
          </div>
        </ParentSection>
      )}

      <ParentSection title={t('parent.unlock-lessons-worlds')}>
        <UnlockPanel profileId={profile.id} />
      </ParentSection>

      <ParentSection title={t('parent.backup-heading')}>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={sharing}
            onClick={() => {
              void shareThisChild();
            }}
            className={`${PARENT_PRIMARY_BUTTON} self-start`}
          >
            {t('parent.backup.share-button-child')}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              void exportThisChild();
            }}
            className={`${PARENT_SECONDARY_BUTTON} self-start`}
          >
            {t('parent.export-child')}
          </button>
        </div>
        {shareNote && <p className={PARENT_NOTE}>{shareNote}</p>}
      </ParentSection>

      <section className="flex flex-col gap-3 rounded-xl border border-today p-4">
        <h3 className="text-sm font-extrabold text-[#8C4012]">{t('parent.danger-heading')}</h3>
        {resetDone && <p className={PARENT_NOTE}>{t('parent.reset-done')}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setResetDone(false);
              setConfirmingReset(true);
            }}
            className={PARENT_DANGER_BUTTON}
          >
            {t('parent.reset')}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(true);
            }}
            className={PARENT_DANGER_BUTTON}
          >
            {t('parent.delete')}
          </button>
        </div>
      </section>

      {confirmingReset && (
        <PasswordConfirmDialog
          title={t('parent.reset-confirm-title', { name: profile.nickname })}
          body={t('parent.reset-confirm-body')}
          confirmLabel={t('parent.reset-confirm')}
          onCancel={() => {
            setConfirmingReset(false);
          }}
          onConfirmed={() => {
            void confirmReset();
          }}
        />
      )}

      {confirmingDelete && (
        <DeleteConfirmDialog
          profile={profile}
          onCancel={() => {
            setConfirmingDelete(false);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      )}
    </div>
  );
}
