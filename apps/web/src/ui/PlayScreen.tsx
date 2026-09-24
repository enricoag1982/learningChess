import { useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { MiniGame } from '@chess-kids/core';
import { unlockedMiniGames } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { avatarName, tContent } from '../content-text.ts';
import { characterPieceOrNull } from './art/character-meta.ts';
import { avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';
import { OwlIcon } from './art/characters.tsx';
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

function LockIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={5} y={11} width={14} height={10} rx={2} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ComputerIcon(): JSX.Element {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2F5E9E"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={4} y={7} width={16} height={12} rx={3} />
      <path d="M12 3v4" />
      <circle cx={9} cy={13} r={1} fill="#2F5E9E" />
      <circle cx={15} cy={13} r={1} fill="#2F5E9E" />
    </svg>
  );
}

function FriendIcon(): JSX.Element {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#B8561A"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={9} cy={8} r={3.5} />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14a6 6 0 0 1 3.5 6" />
    </svg>
  );
}

const BOT_LEVELS = ['mouse', 'rabbit', 'fox', 'wolf', 'bear'] as const;

/**
 * The condition text for a locked mini-game: the piece word for the first lesson of a piece
 * character ("Pawn"), else the lesson's title (Owl-taught lessons, and later lessons of the same
 * character such as "Caterpillar Transforms!").
 */
function unlockLabel(
  t: TFunction,
  lesson: { readonly id: string; readonly character: string; readonly titleKey: string },
  firstLessonOfCharacter: ReadonlyMap<string, string>,
): string {
  const piece = characterPieceOrNull(lesson.character);
  return piece !== null && firstLessonOfCharacter.get(lesson.character) === lesson.id
    ? t(`piece.${piece}`)
    : tContent(t, lesson.titleKey);
}

/** First lesson id per character, in curriculum order (world order is encoded in lesson order within a world). */
function firstLessonsByCharacter(
  lessons: readonly {
    readonly id: string;
    readonly character: string;
    readonly world: string;
    readonly order: number;
  }[],
  worldOrder: ReadonlyMap<string, number>,
): Map<string, string> {
  const sorted = [...lessons].sort(
    (a, b) => (worldOrder.get(a.world) ?? 0) - (worldOrder.get(b.world) ?? 0) || a.order - b.order,
  );
  const first = new Map<string, string>();
  for (const lesson of sorted) {
    if (!first.has(lesson.character)) first.set(lesson.character, lesson.id);
  }
  return first;
}

/** Play: vs Computer (locked in M2), vs Friend (locked), and the unlocked mini-games grid. */
export function PlayScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const miniGameProgress = useAppStore((state) => state.miniGameProgress);
  const journey = useAppStore((state) => state.journey);
  const goToHome = useAppStore((state) => state.goToHome);
  const startMiniGame = useAppStore((state) => state.startMiniGame);

  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const bubbleText = t('play.owl-line');
  const replay = useNarratedText(services.narrator, bubbleText);

  if (!profile || !journey) {
    return <main className="min-h-screen bg-cream" />;
  }

  const games = unlockedMiniGames(journey.lessons, services.deps.content.minigames(), progress);
  const lessonById = new Map(journey.lessons.map((lesson) => [lesson.id, lesson]));
  const worldOrder = new Map(
    journey.catalog.tracks.flatMap((track) =>
      track.worlds.map((world) => [world.id, world.order] as const),
    ),
  );
  const firstLessonOfCharacter = firstLessonsByCharacter(journey.lessons, worldOrder);
  const bestStarsById = new Map(
    miniGameProgress.map((entry) => [entry.miniGameId, entry.bestStars]),
  );

  const checkWorld = journey.worlds.find((w) => w.world.id === 'check');
  const fullGameUnlocked = checkWorld?.status === 'mastered';

  function activateGame(game: MiniGame, unlocked: boolean): void {
    if (!unlocked) {
      const lesson = lessonById.get(game.unlockAfter);
      const label = lesson
        ? unlockLabel(t, lesson, firstLessonOfCharacter)
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

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-cream px-4 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={tContent(t, 'journey:ui.back')}
          onClick={goToHome}
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-line bg-card text-ink"
        >
          <BackIcon />
        </button>
        <h1 className="flex-grow truncate font-display text-2xl text-ink sm:text-3xl">
          {t('play.title')}
        </h1>
        <div className="flex items-center gap-2">
          <div
            role="img"
            aria-label={t('home.avatar-alt', { name: avatarName(t, profile.avatar) })}
            className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full p-1.5"
            style={{ backgroundColor: avatarBackground(profile.avatar) }}
          >
            <AvatarIcon avatar={profile.avatar} />
          </div>
          <span className="font-display text-lg text-ink sm:text-xl">{profile.nickname}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SpeechBubble text={bubbleText} avatarClassName="h-12 w-12" bubbleClassName="text-lg" />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[2rem] border-2 border-line bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#DDE8F6]">
              <ComputerIcon />
            </span>
            <span className="font-display text-xl text-ink sm:text-2xl">
              {t('play.vs-computer')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2" role="list" aria-label={t('play.vs-computer')}>
            {BOT_LEVELS.map((level, index) => (
              <span
                key={level}
                role="listitem"
                className={`rounded-full px-4 py-2 text-sm font-extrabold ${
                  index === 0 ? 'bg-info text-white' : 'bg-[#EEF3FA] text-[#24497D]'
                }`}
              >
                {t(`boss.versus.bot-name.${level}`)}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={!fullGameUnlocked}
            aria-label={
              fullGameUnlocked
                ? t('play.full-game')
                : `${t('play.full-game')}, ${t('play.full-game-locked')}`
            }
            className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-info px-4 font-display text-lg font-semibold text-white disabled:cursor-default disabled:bg-[#DDE8F6] disabled:text-muted"
          >
            {!fullGameUnlocked && <LockIcon />}
            {fullGameUnlocked ? t('play.full-game') : t('play.full-game-locked')}
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-[2rem] border-2 border-line bg-card p-5">
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
            disabled
            aria-label={`${t('play.vs-friend')}, ${t('play.vs-friend-locked')}`}
            className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-[#F3EDE0] px-4 font-display text-lg font-semibold text-muted disabled:cursor-default"
          >
            <LockIcon />
            {t('play.vs-friend-locked')}
          </button>
        </div>
      </div>

      <h2 className="font-display text-xl text-ink sm:text-2xl">{t('play.minigames-heading')}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {games.map(({ minigame, unlocked, bestStars: lessonBestStars }) => {
          const title = tContent(t, minigame.titleKey);
          const bestStars = Math.max(lessonBestStars, bestStarsById.get(minigame.id) ?? 0);
          const lesson = lessonById.get(minigame.unlockAfter);
          const label = lesson ? unlockLabel(t, lesson, firstLessonOfCharacter) : title;
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
                className={`flex min-h-24 w-full flex-col justify-between gap-2 rounded-[1.5rem] border-2 p-3 text-left ${
                  unlocked
                    ? 'border-line bg-card text-ink'
                    : 'border-transparent bg-[#F3EDE0] text-muted'
                }`}
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
                    <LockIcon />
                    {condition}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {lockedMessage && (
        <div className="flex items-center gap-3 rounded-3xl border-2 border-line bg-card px-4 py-3 shadow">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-[#E9DFF3] p-1.5">
            <OwlIcon />
          </div>
          <p className="font-display text-lg text-ink">{lockedMessage}</p>
        </div>
      )}
    </main>
  );
}
