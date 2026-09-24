import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { RankLadderEntry, TracksCatalog } from '@chess-kids/core';
import { animalFriends, rankLadder, totalStars } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { CharacterIcon } from './art/characters.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { StarsPill } from './StarsPill.tsx';
import { useNarratedText } from './useNarratedText.ts';

/** Unicode glyph per rank id (they are exactly the six piece words: pawn .. king). */
const RANK_GLYPH: Readonly<Record<string, string>> = {
  pawn: '♙',
  knight: '♘',
  bishop: '♗',
  rook: '♖',
  queen: '♕',
  king: '♔',
};

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

/** The next rank's unlock condition, in words (own condition for `done`/`locked`, "You are here" for `current`). */
function rankNote(t: TFunction, catalog: TracksCatalog, entry: RankLadderEntry): string {
  if (entry.state === 'current') return t('den.rank-current');
  const { after } = entry.rank;
  if (after === 'start') return t('den.rank-start');
  if (after === 'all-tracks') return t('den.rank-all-tracks');
  if (after.startsWith('world:')) {
    const worldId = after.slice('world:'.length);
    const world = catalog.tracks.flatMap((track) => track.worlds).find((w) => w.id === worldId);
    return t('den.rank-after-world', { order: world?.order ?? 0 });
  }
  const trackId = after.slice('track:'.length);
  const track = catalog.tracks.find((candidate) => candidate.id === trackId);
  return t('den.rank-after-track', { track: track ? tContent(t, track.titleKey) : '' });
}

/** My Den: rank ladder and animal-friend collection (rewards.md §2; badges are M4, omitted here). */
export function DenScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const journey = useAppStore((state) => state.journey);
  const goToHome = useAppStore((state) => state.goToHome);

  const bubbleText = t('den.owl-line');
  const replay = useNarratedText(services.narrator, bubbleText);

  if (!profile || !journey) {
    return <main className="min-h-screen bg-cream" />;
  }

  const friends = animalFriends(journey.lessons, progress);
  const ladder = rankLadder(journey.catalog, journey.lessons, progress);
  const stars = totalStars(progress);

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
          {t('den.title', { name: profile.nickname })}
        </h1>
        <StarsPill count={stars} />
      </div>

      <div className="flex items-center gap-3">
        <SpeechBubble text={bubbleText} avatarClassName="h-12 w-12" bubbleClassName="text-lg" />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="flex flex-col gap-3 rounded-[2rem] border-2 border-line bg-card p-5 lg:w-72 lg:flex-none">
          <h2 className="font-display text-xl text-ink sm:text-2xl">{t('den.rank-heading')}</h2>
          <ul className="flex flex-col gap-2">
            {ladder.map((entry) => {
              const name = tContent(t, `journey:ranks.${entry.rank.id}`);
              const note = rankNote(t, journey.catalog, entry);
              const current = entry.state === 'current';
              const locked = entry.state === 'locked';
              return (
                <li
                  key={entry.rank.id}
                  aria-label={`${name}, ${note}`}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${
                    current ? 'border-go bg-white' : 'border-transparent'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-2xl leading-none ${
                      locked ? 'bg-[#F1E9D8] text-muted' : 'bg-go text-white'
                    }`}
                  >
                    {RANK_GLYPH[entry.rank.id] ?? '?'}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={`text-base font-extrabold ${locked ? 'text-muted' : 'text-ink'}`}
                    >
                      {name}
                    </span>
                    <span className="text-sm font-bold text-muted">{note}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-[2rem] border-2 border-line bg-card p-5">
          <h2 className="font-display text-xl text-ink sm:text-2xl">{t('den.friends-heading')}</h2>
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {friends.map((friend) => {
              const characterLabel = tContent(t, `characters:${friend.character}.name`);
              const pieceLabel = t(`piece.${friend.piece}`);
              const name = friend.earned
                ? t('den.friend-name', { character: characterLabel })
                : t('den.friend-name-locked', { character: characterLabel, piece: pieceLabel });
              return (
                <li
                  key={friend.character}
                  aria-label={name}
                  className="flex flex-col items-center gap-1 text-center"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 ${
                      friend.earned
                        ? 'border-[#E0B98A] bg-[#F9EBD9] p-2'
                        : 'border-line bg-[#F3EDE0]'
                    }`}
                  >
                    {friend.earned ? (
                      <CharacterIcon character={friend.character} />
                    ) : (
                      <span className="font-display text-3xl text-muted">?</span>
                    )}
                  </span>
                  <span className="text-xs font-extrabold text-ink">
                    {friend.earned
                      ? characterLabel
                      : t('den.friend-condition', { piece: pieceLabel })}
                  </span>
                  {friend.earned && (
                    <span className="text-xs font-bold text-muted">{pieceLabel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
