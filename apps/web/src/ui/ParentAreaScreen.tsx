import { useEffect, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@chess-kids/core';
import {
  changeAvatar,
  changeParentPassword,
  deleteProfile,
  isValidPassword,
  renameProfile,
  totalStars,
  validateNickname,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { AVATARS, avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';
import {
  PARENT_DANGER_BUTTON,
  PARENT_INPUT,
  PARENT_NOTE,
  PARENT_PRIMARY_BUTTON,
  PARENT_SECONDARY_BUTTON,
} from './parent/parent-styles.ts';

interface ChildStats {
  readonly stars: number;
  readonly lessonsComplete: number;
}

function LockIcon(): JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Small inline avatar picker for one row (parent style, ≥ 44px targets). */
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
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full p-1.5"
          style={{ backgroundColor: avatarBackground(id) }}
        >
          <AvatarIcon avatar={id} />
        </button>
      ))}
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

function ChangePasswordForm({ onDone }: { readonly onDone: () => void }): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isValidPassword(password)) {
      setError(t('first-run.password.too-short'));
      return;
    }
    if (password !== repeat) {
      setError(t('first-run.password.mismatch'));
      return;
    }
    await changeParentPassword(services.deps, password);
    onDone();
  }

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4"
    >
      <label className="flex flex-col gap-1 text-sm font-bold text-ink">
        {t('parent.new-password-label')}
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          className={PARENT_INPUT}
          autoComplete="new-password"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold text-ink">
        {t('first-run.password.repeat-label')}
        <input
          type="password"
          value={repeat}
          onChange={(event) => {
            setRepeat(event.target.value);
          }}
          className={PARENT_INPUT}
          autoComplete="new-password"
        />
      </label>
      {error && <p className={PARENT_NOTE}>{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className={PARENT_PRIMARY_BUTTON}>
          {t('parent.save')}
        </button>
        <button type="button" onClick={onDone} className={PARENT_SECONDARY_BUTTON}>
          {t('parent.cancel')}
        </button>
      </div>
    </form>
  );
}

function ChildRow({
  profile,
  stats,
  onRefresh,
}: {
  readonly profile: Profile;
  readonly stats: ChildStats | undefined;
  readonly onRefresh: () => Promise<void>;
}): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [renaming, setRenaming] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function submitRename(): Promise<void> {
    if (!validateNickname(nickname)) return;
    await renameProfile(services.deps, profile.id, nickname);
    setRenaming(false);
    await onRefresh();
  }

  async function pickAvatar(avatar: string): Promise<void> {
    await changeAvatar(services.deps, profile.id, avatar);
    setPickingAvatar(false);
    await onRefresh();
  }

  async function confirmDelete(): Promise<void> {
    await deleteProfile(services.deps, profile.id);
    setConfirmingDelete(false);
    await onRefresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
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
        <span className="text-sm text-muted">
          {t('parent.stars-total', { count: stats?.stars ?? 0 })}
        </span>
        <span className="text-sm text-muted">
          {t('parent.lessons-complete', { count: stats?.lessonsComplete ?? 0 })}
        </span>
      </div>

      {pickingAvatar && (
        <AvatarPicker
          onPick={(avatar) => {
            void pickAvatar(avatar);
          }}
        />
      )}

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
    </li>
  );
}

/** Parent area (parent style, ≥ 44px targets): children list + management, behind the parent gate. */
export function ParentAreaScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profiles = useAppStore((state) => state.profiles);
  const goToPicker = useAppStore((state) => state.goToPicker);
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);
  const startNewPlayer = useAppStore((state) => state.startNewPlayer);
  const [stats, setStats] = useState<Readonly<Record<string, ChildStats>>>({});
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      profiles.map(async (profile) => {
        const lessons = await services.deps.progress.listLessons(profile.id);
        const entry: ChildStats = {
          stars: totalStars(lessons),
          lessonsComplete: lessons.filter((lesson) => lesson.completedAt !== undefined).length,
        };
        return [profile.id, entry] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setStats(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [profiles, services]);

  return (
    <main className="min-h-screen bg-[#F7F4EE] px-4 py-4 sm:px-8 sm:py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <LockIcon />
          <h1 className="flex-1 text-xl font-extrabold text-ink">{t('parent.title')}</h1>
          <button
            type="button"
            onClick={() => {
              void goToPicker();
            }}
            className={PARENT_SECONDARY_BUTTON}
          >
            {t('parent.done')}
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
            {t('parent.children')}
          </h2>
          <ul className="flex flex-col gap-3">
            {profiles.map((profile) => (
              <ChildRow
                key={profile.id}
                profile={profile}
                stats={stats[profile.id]}
                onRefresh={refreshProfiles}
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              startNewPlayer(true);
            }}
            className={PARENT_SECONDARY_BUTTON}
          >
            {t('parent.add-child')}
          </button>
        </section>

        <section className="flex flex-col gap-3">
          {changingPassword ? (
            <ChangePasswordForm
              onDone={() => {
                setChangingPassword(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setChangingPassword(true);
              }}
              className={`${PARENT_SECONDARY_BUTTON} self-start`}
            >
              {t('parent.change-password')}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
