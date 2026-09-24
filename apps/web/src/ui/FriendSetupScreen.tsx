import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { friendGameOptions } from '@chess-kids/core';
import type { FriendBoardMode, FriendOpponentChoice } from '../app/store.ts';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { useNarratedText } from './useNarratedText.ts';

function BackIcon(): JSX.Element {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function GuestIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={50} cy={38} r={20} fill="#B7C2CB" />
      <path d="M18 88c0-20 14-32 32-32s32 12 32 32Z" fill="#B7C2CB" />
    </svg>
  );
}

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
      className={`flex h-16 min-h-16 items-center justify-center rounded-2xl border-2 px-5 font-display text-lg font-semibold ${
        selected ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Play's vs Friend setup sheet (`docs/app-structure.md` §6): second player (another profile or a
 * guest), game (only what is already unlocked for the active profile), board mode, legal-move
 * dots and swap-colours, then "Start" opens the friend game screen (`FriendGameScreen`).
 */
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
  const goToPlay = useAppStore((state) => state.goToPlay);

  const bubbleText = t('friend-play.setup-owl-line');
  const replay = useNarratedText(services.narrator, bubbleText);

  if (!profile || !journey) {
    return <main className="min-h-screen bg-cream" />;
  }

  const otherProfiles = profiles.filter((candidate) => candidate.id !== profile.id);
  const options = friendGameOptions(
    gameRecords,
    journey,
    services.deps.content.lessons(),
    services.deps.content.minigames(),
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
    <main className="flex min-h-screen flex-col gap-4 bg-cream px-4 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={tContent(t, 'journey:ui.back')}
          onClick={goToPlay}
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-line bg-card text-ink"
        >
          <BackIcon />
        </button>
        <h1 className="flex-grow truncate font-display text-2xl text-ink sm:text-3xl">
          {t('friend-play.setup-title')}
        </h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SpeechBubble text={bubbleText} avatarClassName="h-12 w-12" bubbleClassName="text-lg" />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>

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
                className={`flex w-28 flex-col items-center gap-2 rounded-3xl border-2 p-3 ${
                  isOpponentSelected({ kind: 'profile', profileId: candidate.id })
                    ? 'border-go bg-white'
                    : 'border-line bg-card'
                }`}
              >
                <span
                  className="h-16 w-16 overflow-hidden rounded-full p-2"
                  style={{ backgroundColor: avatarBackground(candidate.avatar) }}
                >
                  <AvatarIcon avatar={candidate.avatar} />
                </span>
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
              className={`flex w-28 flex-col items-center gap-2 rounded-3xl border-2 p-3 ${
                isOpponentSelected({ kind: 'guest' }) ? 'border-go bg-white' : 'border-line bg-card'
              }`}
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
        className="mt-auto flex h-20 items-center justify-center gap-3 rounded-3xl bg-go px-6 font-display text-2xl font-semibold text-white disabled:cursor-default disabled:bg-[#DDE8F6] disabled:text-muted"
      >
        {t('friend-play.start')}
      </button>
    </main>
  );
}
