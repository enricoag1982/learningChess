import { useEffect, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChildOverview } from '@chess-kids/core';
import { buildChildOverview, changeParentPassword, isValidPassword } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';
import { RankPill } from './RankPill.tsx';
import { BackupScreen } from './parent/BackupPanel.tsx';
import { ChildReportScreen } from './parent/ChildReport.tsx';
import { ChildSettingsScreen } from './parent/ChildSettings.tsx';
import { ChevronRightIcon } from './parent/parent-icons.tsx';
import { PrivacyScreen } from './parent/PrivacyPolicy.tsx';
import {
  PARENT_INPUT,
  PARENT_NOTE,
  PARENT_PRIMARY_BUTTON,
  PARENT_SECONDARY_BUTTON,
  PARENT_TAPPABLE_ROW,
} from './parent/parent-styles.ts';

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

/** One child's Overview card (app-structure.md §11): avatar, nickname, rank, total stars, minutes
 * today / last 7 days, streak — a tappable row (docs/screens.md §1 "tappable vs info", roadmap F3)
 * that opens that child's report. */
function ChildOverviewCard({
  overview,
  onOpen,
}: {
  readonly overview: ChildOverview;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li>
      <button type="button" onClick={onOpen} className={PARENT_TAPPABLE_ROW}>
        <span
          className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full p-1.5"
          style={{ backgroundColor: avatarBackground(overview.profile.avatar) }}
        >
          <AvatarIcon avatar={overview.profile.avatar} />
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="text-base font-extrabold text-ink">{overview.profile.nickname}</span>
            <RankPill rank={overview.rank} />
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>{t('parent.stars-total', { count: overview.totalStars })}</span>
            <span>
              {t('parent.overview.minutes-today', { count: overview.minutesToday })}
              {' · '}
              {t('parent.overview.minutes-7-days', { count: overview.minutesLast7Days })}
            </span>
            {overview.streakCurrent >= 2 && (
              <span>{t('parent.overview.streak', { count: overview.streakCurrent })}</span>
            )}
          </span>
        </span>
        <ChevronRightIcon />
      </button>
    </li>
  );
}

/** Which parent-area sub-screen shows, below the shared `ParentAreaScreen` header. */
type ParentView =
  | { readonly kind: 'overview' }
  | { readonly kind: 'report'; readonly profileId: string }
  | { readonly kind: 'settings'; readonly profileId: string }
  | { readonly kind: 'backup' }
  | { readonly kind: 'privacy' };

/** Parent area (parent style, ≥ 44px targets, WCAG 2.2 AA): overview → child report → child
 * settings; backup export / import — behind the parent gate (app-structure.md §11, M5.1). */
export function ParentAreaScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profiles = useAppStore((state) => state.profiles);
  const goToPicker = useAppStore((state) => state.goToPicker);
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);
  const startNewPlayer = useAppStore((state) => state.startNewPlayer);
  const [overviews, setOverviews] = useState<Readonly<Record<string, ChildOverview>>>({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [view, setView] = useState<ParentView>({ kind: 'overview' });

  // Also re-fetches on every return to `'overview'` (not only when `profiles` itself changes): a
  // child's stats can change on the Report/Settings screens (reset, an import) without the
  // `profiles` array reference changing at all, and the Overview must show fresh numbers each time
  // it is shown again, not just the ones from when it first mounted.
  useEffect(() => {
    if (view.kind !== 'overview') return;
    let cancelled = false;
    void Promise.all(
      profiles.map(
        async (profile) =>
          [profile.id, await buildChildOverview(services.deps, profile.id)] as const,
      ),
    ).then((entries) => {
      if (!cancelled) setOverviews(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [profiles, services, view.kind]);

  const settingsProfile =
    view.kind === 'settings'
      ? profiles.find((profile) => profile.id === view.profileId)
      : undefined;

  return (
    <main className="min-h-screen bg-[#F7F4EE] px-4 py-4 sm:px-8 sm:py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {view.kind === 'overview' && (
          <>
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
                {profiles.map((profile) => {
                  const overview = overviews[profile.id];
                  return overview ? (
                    <ChildOverviewCard
                      key={profile.id}
                      overview={overview}
                      onOpen={() => {
                        setView({ kind: 'report', profileId: profile.id });
                      }}
                    />
                  ) : null;
                })}
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
              <button
                type="button"
                onClick={() => {
                  setView({ kind: 'backup' });
                }}
                className={PARENT_TAPPABLE_ROW}
              >
                <span className="flex-1 text-sm font-extrabold text-ink">
                  {t('parent.backup-nav')}
                </span>
                <ChevronRightIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView({ kind: 'privacy' });
                }}
                className={PARENT_TAPPABLE_ROW}
              >
                <span className="flex-1 text-sm font-extrabold text-ink">
                  {t('parent.privacy-nav')}
                </span>
                <ChevronRightIcon />
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

            <p className="text-center text-xs text-muted">
              {t('parent.version', { version: __APP_VERSION__ })}
            </p>
          </>
        )}

        {view.kind === 'report' && (
          <ChildReportScreen
            key={view.profileId}
            profileId={view.profileId}
            profiles={profiles}
            onBack={() => {
              setView({ kind: 'overview' });
            }}
            onOpenSettings={() => {
              setView({ kind: 'settings', profileId: view.profileId });
            }}
          />
        )}

        {view.kind === 'settings' &&
          (settingsProfile ? (
            <ChildSettingsScreen
              key={settingsProfile.id}
              profile={settingsProfile}
              onBack={() => {
                setView({ kind: 'report', profileId: view.profileId });
              }}
              onDeleted={() => {
                setView({ kind: 'overview' });
              }}
            />
          ) : null)}

        {view.kind === 'backup' && (
          <BackupScreen
            onBack={() => {
              setView({ kind: 'overview' });
            }}
            onImported={() => {
              // Refreshes the Overview's own profile list in the background, but stays on this
              // screen (the parent reads "Import complete." first, then Back returns themselves).
              void refreshProfiles();
            }}
          />
        )}

        {view.kind === 'privacy' && (
          <PrivacyScreen
            onBack={() => {
              setView({ kind: 'overview' });
            }}
          />
        )}
      </div>
    </main>
  );
}
