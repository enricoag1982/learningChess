import { useEffect, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  GameRecord,
  Journey,
  PieceStyleSetting,
  Profile,
  ProfileSettings,
} from '@chess-kids/core';
import {
  changeAvatar,
  computerLevelStatus,
  DAILY_LIMIT_OPTIONS,
  deleteProfile,
  getProfileSettings,
  loadGameRecords,
  loadJourney,
  renameProfile,
  resetProfileData,
  updateProfileSettings,
  validateNickname,
  verifyParentPassword,
} from '@chess-kids/core';
import { exportBackup } from '@chess-kids/core/backup';
import { useAppStore, useServices } from '../../app/store.ts';
import { AVATARS, avatarBackground } from '../art/avatar-meta.ts';
import { AvatarIcon } from '../art/avatars.tsx';
import { ChevronLeftIcon } from './parent-icons.tsx';
import {
  PARENT_CHIP,
  PARENT_CHIP_LOCKED,
  PARENT_CHIP_SELECTED,
  PARENT_DANGER_BUTTON,
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
          className="tap-raised flex h-11 w-11 items-center justify-center overflow-hidden rounded-full p-1.5"
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-card p-6"
      >
        <h2 className="text-base font-extrabold text-ink">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
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
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={PARENT_SECONDARY_BUTTON}>
            {t('parent.cancel')}
          </button>
          <button type="submit" disabled={busy} className={PARENT_DANGER_BUTTON}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-card p-6">
        <h2 className="text-base font-extrabold text-ink">
          {t('parent.delete-confirm-title', { name: profile.nickname })}
        </h2>
        <p className="text-sm text-muted">{t('parent.delete-confirm-body')}</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={PARENT_SECONDARY_BUTTON}>
            {t('parent.delete-cancel')}
          </button>
          <button type="button" onClick={onConfirm} className={PARENT_DANGER_BUTTON}>
            {t('parent.delete-confirm')}
          </button>
        </div>
      </div>
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
      className="tap-raised flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-card px-4 py-2 text-left"
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

/**
 * Parent area "child settings" (app-structure.md §11): rename / avatar / delete (moved here from
 * the old flat overview row), daily limit / voice / sound / hints / computer level / piece style,
 * unlock lessons & worlds (M4.5's `UnlockPanel`, integrated here rather than duplicated), export
 * this child's data, and reset. Settings effects (`docs/app-structure.md` §11 "Settings effect
 * now"): voice/sound/hints/computer level take effect the next time this profile is selected
 * (`selectProfileAndHome` re-reads them); daily limit is enforced live, from the very next activity
 * gate check (M5.2, `store.ts`'s `gated`); piece style only stored until M5.3.
 */
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
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [gameRecords, setGameRecords] = useState<readonly GameRecord[]>([]);

  // No effect resyncing `nickname` to `profile.nickname`: the caller remounts this component with
  // `key={profile.id}` (`ParentAreaScreen.tsx`) whenever it opens a different child's settings, so
  // `useState(profile.nickname)` above is always the right initial value.
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

  async function patchSettings(patch: Partial<ProfileSettings>): Promise<void> {
    const updated = await updateProfileSettings(services.deps, profile.id, patch);
    setSettings(updated);
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

  const levelStatuses = journey ? computerLevelStatus(gameRecords, journey) : [];

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
        <h2 className="flex-1 text-base font-extrabold text-ink">
          {t('parent.settings-title', { name: profile.nickname })}
        </h2>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <div className="flex items-center gap-3">
          <span
            className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full p-1.5"
            style={{ backgroundColor: avatarBackground(profile.avatar) }}
          >
            <AvatarIcon avatar={profile.avatar} />
          </span>
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
      </section>

      {settings && (
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-extrabold text-ink">{t('parent.daily-limit-heading')}</h3>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('parent.daily-limit-heading')}
            >
              {DAILY_LIMIT_OPTIONS.map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  aria-pressed={settings.dailyLimitMinutes === option}
                  onClick={() => {
                    void patchSettings({ dailyLimitMinutes: option });
                  }}
                  className={
                    settings.dailyLimitMinutes === option ? PARENT_CHIP_SELECTED : PARENT_CHIP
                  }
                >
                  {option === null
                    ? t('parent.daily-limit-off')
                    : t('parent.daily-limit-minutes', { count: option })}
                </button>
              ))}
            </div>
            <p className={PARENT_NOTE}>{t('parent.daily-limit-note')}</p>
          </div>

          <ToggleRow
            label={t('parent.voice-label')}
            checked={settings.voice}
            onChange={(value) => {
              void patchSettings({ voice: value });
            }}
          />
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
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.unlock-lessons-worlds')}</h3>
        <UnlockPanel profileId={profile.id} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.backup-heading')}</h3>
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
      </section>

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
