import { useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ComputerLevelCondition, ComputerLevelStatus } from '../../chess.ts';
import type { MiniGame } from '../../core/chess/lesson.ts';
import { chessCore } from '../../core/chess-core.ts';
import { computerLevelStatus, friendGameOptions, suggestedLevel } from '../../chess.ts';
import { unlockedMiniGames, worldOrderById } from '@learn/platform-core';
import { useAppStore, useServices } from '@learn/platform-web/app/store.ts';
import { avatarName, tContent } from '@learn/platform-web/content-text.ts';
import {
  firstLessonsByCharacter,
  unlockLabel,
} from '@learn/platform-web/ui/lesson-character-labels.ts';
import { animalImage } from '@learn/platform-web/ui/art/animal-images.ts';
import { OwlIcon } from '@learn/platform-web/ui/art/characters.tsx';
import { NarratedBubble } from '@learn/platform-web/ui/ds/NarratedBubble.tsx';
import { ComputerIcon, FriendIcon, LockIcon } from '@learn/platform-web/ui/ds/icons.tsx';
import { tapClass } from '@learn/platform-web/ui/ds/tap.ts';
import { BlankScreen, Screen, ScreenHeader } from '@learn/platform-web/ui/ds/Screen.tsx';
import { useAsync } from '@learn/platform-web/ui/ds/useAsync.ts';
import { AvatarBadge } from '@learn/platform-web/ui/ds/AvatarBadge.tsx';

function levelConditionText(t: TFunction, condition: ComputerLevelCondition): string {
  if (condition.kind === 'world-mastered') {
    return t('play.full-game-locked');
  }
  return t('play.level-condition-beat', {
    name: t(`boss.versus.bot-name.${condition.level}`),
    times: condition.times,
  });
}

/** Play: vs Computer, vs Friend (setup sheet `FriendSetupScreen`, once any game is unlocked) and the unlocked mini-games grid. */
export function PlayScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const miniGameProgress = useAppStore((state) => state.miniGameProgress);
  const gameRecords = useAppStore((state) => state.gameRecords);
  const journey = useAppStore((state) => state.journey);
  const computerLevelSetting = useAppStore((state) => state.activeProfileSettings.computerLevel);
  const levelUpSuggestion = useAppStore((state) => state.levelUpSuggestion);
  const goToHome = useAppStore((state) => state.goToHome);
  const startMiniGame = useAppStore((state) => state.startMiniGame);
  const startFullGame = useAppStore((state) => state.startFullGame);
  const goToFriendSetup = useAppStore((state) => state.goToFriendSetup);

  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  // `null` = no manual pick yet this session: the level chips default to the profile's stored
  // "Automatic level" suggestion (`docs/computer-opponent.md` §5), loaded once below.
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const bubbleText = t('play.owl-line');
  const { value: storedSuggestion } = useAsync(
    () =>
      services.deps.settings.get().then((settings) => settings.suggestedLevels[profile?.id ?? '']),
    [services, profile?.id],
    !!profile,
  );

  if (!profile || !journey) {
    return <BlankScreen />;
  }

  const games = unlockedMiniGames(journey.lessons, services.subject.content.minigames(), progress);
  const lessonById = new Map(journey.lessons.map((lesson) => [lesson.id, lesson]));
  const firstLessonOfCharacter = firstLessonsByCharacter(
    journey.lessons,
    worldOrderById(journey.catalog),
  );
  const bestStarsById = new Map(
    miniGameProgress.map((entry) => [entry.miniGameId, entry.bestStars]),
  );

  const friendOptions = friendGameOptions(
    gameRecords,
    journey,
    journey.lessons,
    services.subject.content.minigames(),
    progress,
  );
  const friendUnlocked = friendOptions.length > 0;

  const levelStatuses = computerLevelStatus(gameRecords, journey);
  // A fixed "computer level" setting preselects that level (when unlocked) and disables the
  // automatic suggestion; a manual chip tap this session still wins over either.
  const fixedLevel =
    computerLevelSetting !== 'auto'
      ? levelStatuses.find((status) => status.level === computerLevelSetting && !status.locked)
          ?.level
      : undefined;
  const effectiveLevel =
    selectedLevel ?? fixedLevel ?? suggestedLevel(storedSuggestion, levelStatuses);
  // The only level `effectiveLevel` can ever resolve to locked is Mouse (`suggestedLevel`'s own
  // fallback with nothing unlocked yet).
  const selectedStatus = levelStatuses.find((status) => status.level === effectiveLevel);
  const fullGameUnlocked = selectedStatus !== undefined && !selectedStatus.locked;
  const levelUpStatus = levelUpSuggestion
    ? levelStatuses.find((status) => status.level === levelUpSuggestion.level)
    : undefined;
  const levelUpBanner = levelUpStatus
    ? t('play.level-up-suggestion', { name: t(`boss.versus.bot-name.${levelUpStatus.name}`) })
    : null;

  function selectLevel(status: ComputerLevelStatus): void {
    if (status.locked) {
      if (status.condition === undefined) return;
      const message = t('play.level-name-locked', {
        name: t(`boss.versus.bot-name.${status.name}`),
        condition: levelConditionText(t, status.condition),
      });
      setLockedMessage(message);
      services.narrator.cancel();
      void services.narrator.speak(message);
      return;
    }
    setLockedMessage(null);
    setSelectedLevel(status.level);
  }

  function activateGame(game: MiniGame, unlocked: boolean): void {
    if (!unlocked) {
      const lesson = lessonById.get(game.unlockAfter);
      const label = lesson
        ? unlockLabel(t, chessCore.characters, lesson, firstLessonOfCharacter)
        : tContent(t, game.titleKey);
      const message = t('play.locked-condition', { label });
      setLockedMessage(message);
      services.narrator.cancel();
      void services.narrator.speak(message);
      return;
    }
    setLockedMessage(null);
    startMiniGame(game.id);
  }

  function activateFriend(): void {
    if (!friendUnlocked) {
      const message = t('play.vs-friend-locked');
      setLockedMessage(message);
      services.narrator.cancel();
      void services.narrator.speak(message);
      return;
    }
    setLockedMessage(null);
    goToFriendSetup();
  }

  return (
    <Screen kind="page">
      <ScreenHeader
        action="back"
        actionLabel={tContent(t, 'journey:ui.back')}
        onAction={goToHome}
        title={t('play.title')}
      >
        <div className="flex items-center gap-2">
          <AvatarBadge
            avatar={profile.avatar}
            label={t('home.avatar-alt', { name: avatarName(t, profile.avatar) })}
            className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full p-1.5"
          />
          <span className="font-display text-lg text-ink sm:text-xl">{profile.nickname}</span>
        </div>
      </ScreenHeader>

      <NarratedBubble
        text={bubbleText}
        layout="row"
        avatarClassName="h-12 w-12"
        bubbleClassName="text-lg"
      />

      {/* Both cards below are flat, no border (docs/screens.md §1 "Cards that contain buttons",
          v1.1.0 part B, the rule's own named example): each wraps raised level chips/buttons, so a
          bordered outer card would itself read as a second, competing button around them. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="info-flat flex flex-col gap-3 rounded-[2rem] bg-[#F3EDE0] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#DDE8F6]">
              <ComputerIcon />
            </span>
            <span className="font-display text-xl text-ink sm:text-2xl">
              {t('play.vs-computer')}
            </span>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={t('play.vs-computer')}>
            {levelStatuses.map((status) => {
              const name = t(`boss.versus.bot-name.${status.name}`);
              const selected = !status.locked && status.level === effectiveLevel;
              const condition = status.condition ? levelConditionText(t, status.condition) : '';
              const accessibleName = status.locked
                ? t('play.level-name-locked', { name, condition })
                : status.games > 0
                  ? t('play.level-name-wins', { name, wins: status.wins, games: status.games })
                  : t('play.level-name-unplayed', { name });
              return (
                <li key={status.name}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={accessibleName}
                    onClick={() => {
                      selectLevel(status);
                    }}
                    className={tapClass(
                      'custom',
                      'none',
                      `flex flex-col items-start gap-0.5 rounded-2xl px-4 py-2 text-left ${
                        status.locked
                          ? 'tap-locked bg-[#F3EDE0] text-muted'
                          : selected
                            ? 'tap-info bg-info text-white'
                            : 'bg-[#EEF3FA] text-[#24497D]'
                      }`,
                    )}
                  >
                    <span className="flex items-center gap-1.5" aria-hidden="true">
                      <img
                        src={animalImage(status.name)}
                        alt=""
                        draggable={false}
                        className={`h-6 w-6 flex-shrink-0 rounded-full object-contain ${
                          status.locked ? 'opacity-50' : ''
                        }`}
                      />
                      <span className="text-sm font-extrabold">{name}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold" aria-hidden="true">
                      {status.locked ? (
                        <>
                          <LockIcon size={18} />
                          {condition}
                        </>
                      ) : status.games > 0 ? (
                        t('play.level-wins', { wins: status.wins, games: status.games })
                      ) : (
                        t('play.level-unplayed')
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={!fullGameUnlocked}
            aria-label={
              fullGameUnlocked
                ? t('play.full-game')
                : `${t('play.full-game')}, ${t('play.full-game-locked')}`
            }
            onClick={() => {
              startFullGame(effectiveLevel);
            }}
            className={tapClass(
              'custom',
              'info',
              'flex h-16 items-center justify-center gap-2 rounded-2xl px-4 font-display text-lg font-semibold disabled:cursor-default disabled:bg-[#DDE8F6] disabled:text-muted',
            )}
          >
            {!fullGameUnlocked && <LockIcon size={18} />}
            {fullGameUnlocked ? t('play.full-game') : t('play.full-game-locked')}
          </button>
        </div>

        <div className="info-flat flex flex-col gap-3 rounded-[2rem] bg-[#F3EDE0] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#FBE3D2]">
              <FriendIcon />
            </span>
            <div className="flex flex-col">
              <span className="font-display text-xl text-ink sm:text-2xl">
                {t('play.vs-friend')}
              </span>
              <span className="text-sm font-bold text-muted">{t('play.vs-friend-note')}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label={
              friendUnlocked
                ? t('play.vs-friend')
                : `${t('play.vs-friend')}, ${t('play.vs-friend-locked')}`
            }
            onClick={activateFriend}
            className={tapClass(
              'custom',
              'none',
              `flex h-16 items-center justify-center gap-2 rounded-2xl px-4 font-display text-lg font-semibold ${
                friendUnlocked
                  ? 'tap-today bg-today text-white'
                  : 'tap-locked bg-[#F3EDE0] text-muted'
              }`,
            )}
          >
            {!friendUnlocked && <LockIcon size={18} />}
            {friendUnlocked ? t('play.vs-friend') : t('play.vs-friend-locked')}
          </button>
        </div>
      </div>

      <h2 className="font-display text-xl text-ink sm:text-2xl">{t('play.minigames-heading')}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {games.map(({ minigame, unlocked, bestStars: lessonBestStars }) => {
          const title = tContent(t, minigame.titleKey);
          const bestStars = Math.max(lessonBestStars, bestStarsById.get(minigame.id) ?? 0);
          const lesson = lessonById.get(minigame.unlockAfter);
          const label = lesson
            ? unlockLabel(t, chessCore.characters, lesson, firstLessonOfCharacter)
            : title;
          const condition = t('play.locked-condition', { label });
          const accessibleName = unlocked
            ? t('play.minigame-name-stars', {
                title,
                stars: t('stars-count', { count: bestStars }),
              })
            : t('play.minigame-name-locked', { title, condition });

          return (
            <li key={minigame.id}>
              <button
                type="button"
                aria-label={accessibleName}
                onClick={() => {
                  activateGame(minigame, unlocked);
                }}
                className={tapClass(
                  'custom',
                  'none',
                  `flex min-h-24 w-full flex-col justify-between gap-2 rounded-[1.5rem] p-3 text-left ${
                    unlocked ? 'bg-card text-ink' : 'tap-locked bg-[#F3EDE0] text-muted'
                  }`,
                )}
              >
                <span className="font-display text-base font-semibold leading-tight sm:text-lg">
                  {title}
                </span>
                {unlocked ? (
                  <span className="text-sm font-bold text-muted">
                    {t('stars-count', { count: bestStars })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <LockIcon size={18} />
                    {condition}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {(lockedMessage ?? levelUpBanner) && (
        <div className="info-flat flex items-center gap-3 rounded-3xl bg-card px-4 py-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-[#E9DFF3] p-1.5">
            <OwlIcon />
          </div>
          <p className="font-display text-lg text-ink">{lockedMessage ?? levelUpBanner}</p>
        </div>
      )}
    </Screen>
  );
}
