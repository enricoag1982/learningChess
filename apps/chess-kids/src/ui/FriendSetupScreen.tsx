import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { friendGameOptions } from '@learn/subject-chess';
import type { FriendBoardMode, FriendOpponentChoice } from '../app/slices/play.ts';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { GuestIcon } from './ds/icons-lazy.tsx';
import { tapClass } from './ds/tap.ts';
import { BlankScreen, Screen, ScreenHeader } from './ds/Screen.tsx';
import { AvatarBadge } from './ds/AvatarBadge.tsx';

/** A picked/unpicked chip button, ≥64px tall (kid touch target, `docs/screens.md` §1). */
function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={tapClass(
        'custom',
        selected ? 'go' : 'neutral',
        'flex h-16 min-h-16 items-center justify-center rounded-2xl px-5 font-display text-lg font-semibold',
      )}
    >
      {label}
    </button>
  );
}

/** Play's vs Friend setup sheet (`docs/app-structure.md` §6): second player, game (unlocked
 * only), board mode, legal-move dots, swap-colours; "Start" opens `FriendGameScreen`. */
export function FriendSetupScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const profiles = useAppStore((state) => state.profiles);
  const progress = useAppStore((state) => state.progress);
  const gameRecords = useAppStore((state) => state.gameRecords);
  const journey = useAppStore((state) => state.journey);
  const friendSetup = useAppStore((state) => state.friendSetup);
  const updateFriendSetup = useAppStore((state) => state.updateFriendSetup);
  const startFriendGame = useAppStore((state) => state.startFriendGame);
  const navigate = useAppStore((state) => state.navigate);
  const goToPlay = (): void => void navigate({ name: 'play' });

  const bubbleText = t('friend-play.setup-owl-line');

  if (!profile || !journey) {
    return <BlankScreen />;
  }

  const otherProfiles = profiles.filter((candidate) => candidate.id !== profile.id);
  const options = friendGameOptions(
    gameRecords,
    journey,
    services.subject.content.lessons(),
    services.subject.content.minigames(),
    progress,
  );

  function chooseOpponent(choice: FriendOpponentChoice): void {
    updateFriendSetup({ opponent: choice });
  }

  function isOpponentSelected(choice: FriendOpponentChoice): boolean {
    const current = friendSetup.opponent;
    if (!current) return false;
    if (choice.kind === 'guest') return current.kind === 'guest';
    return current.kind === 'profile' && current.profileId === choice.profileId;
  }

  const canStart = friendSetup.opponent !== null && friendSetup.gameId !== null;

  return (
    <Screen kind="page">
      <ScreenHeader
        action="back"
        actionLabel={tContent(t, 'journey:ui.back')}
        onAction={goToPlay}
        title={t('friend-play.setup-title')}
      />

      <NarratedBubble
        text={bubbleText}
        layout="row"
        avatarClassName="h-12 w-12"
        bubbleClassName="text-lg"
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink">{t('friend-play.second-player-heading')}</h2>
        <ul className="flex flex-wrap gap-3" aria-label={t('friend-play.second-player-heading')}>
          {otherProfiles.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                aria-pressed={isOpponentSelected({ kind: 'profile', profileId: candidate.id })}
                onClick={() => {
                  chooseOpponent({ kind: 'profile', profileId: candidate.id });
                }}
                className={tapClass(
                  'custom',
                  'none',
                  `flex w-28 flex-col items-center gap-2 rounded-3xl p-3 ${
                    isOpponentSelected({ kind: 'profile', profileId: candidate.id })
                      ? 'tap-border-go bg-white'
                      : 'bg-card'
                  }`,
                )}
              >
                <AvatarBadge
                  avatar={candidate.avatar}
                  className="h-16 w-16 overflow-hidden rounded-full p-2"
                />
                <span className="truncate font-display text-base font-semibold text-ink">
                  {candidate.nickname}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-pressed={isOpponentSelected({ kind: 'guest' })}
              onClick={() => {
                chooseOpponent({ kind: 'guest' });
              }}
              className={tapClass(
                'custom',
                'none',
                `flex w-28 flex-col items-center gap-2 rounded-3xl p-3 ${
                  isOpponentSelected({ kind: 'guest' }) ? 'tap-border-go bg-white' : 'bg-card'
                }`,
              )}
            >
              <span className="h-16 w-16 overflow-hidden rounded-full bg-[#EDEFF1] p-2">
                <GuestIcon />
              </span>
              <span className="truncate font-display text-base font-semibold text-ink">
                {t('friend-play.guest')}
              </span>
            </button>
          </li>
        </ul>
        {otherProfiles.length === 0 && (
          <p className="text-sm font-semibold text-muted">{t('friend-play.no-other-profiles')}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink">{t('friend-play.game-heading')}</h2>
        {options.length === 0 ? (
          <p className="text-sm font-semibold text-muted">{t('friend-play.no-games-yet')}</p>
        ) : (
          <ul className="flex flex-wrap gap-3" aria-label={t('friend-play.game-heading')}>
            {options.map((option) => (
              <li key={option.id}>
                <ChoiceChip
                  label={tContent(t, option.titleKey)}
                  selected={friendSetup.gameId === option.id}
                  onClick={() => {
                    updateFriendSetup({ gameId: option.id });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink">{t('friend-play.board-mode-heading')}</h2>
        <div
          className="flex flex-wrap gap-3"
          role="group"
          aria-label={t('friend-play.board-mode-heading')}
        >
          {(['pass-and-play', 'face-to-face'] as const satisfies readonly FriendBoardMode[]).map(
            (mode) => (
              <ChoiceChip
                key={mode}
                label={t(`friend-play.board-mode-${mode}`)}
                selected={friendSetup.boardMode === mode}
                onClick={() => {
                  updateFriendSetup({ boardMode: mode });
                }}
              />
            ),
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <ChoiceChip
          label={
            friendSetup.legalMoveDots
              ? t('friend-play.legal-move-dots-on')
              : t('friend-play.legal-move-dots-off')
          }
          selected={friendSetup.legalMoveDots}
          onClick={() => {
            updateFriendSetup({ legalMoveDots: !friendSetup.legalMoveDots });
          }}
        />
        <ChoiceChip
          label={t('friend-play.swap-colours')}
          selected={friendSetup.swapColours}
          onClick={() => {
            updateFriendSetup({ swapColours: !friendSetup.swapColours });
          }}
        />
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={startFriendGame}
        className={tapClass(
          'next',
          'go',
          'mt-auto disabled:cursor-default disabled:bg-[#DDE8F6] disabled:text-muted',
        )}
      >
        {t('friend-play.start')}
      </button>
    </Screen>
  );
}
