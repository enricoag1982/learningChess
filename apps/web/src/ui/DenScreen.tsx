import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type {
  BadgeCategory,
  BadgeDef,
  BadgeTier,
  EarnedBadge,
  RankLadderEntry,
  TracksCatalog,
} from '@chess-kids/core';
import { animalFriends, friendGamesPlayed, rankLadder, totalStars } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { BadgeIcon } from './BadgeIcon.tsx';
import { CharacterIcon } from './art/characters.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { StarsPill } from './StarsPill.tsx';
import { StreakPill } from './StreakPill.tsx';
import { InfoPill } from './primitives.tsx';
import { useNarratedText } from './useNarratedText.ts';

/** Badge categories, in rewards.md §3 catalogue order. */
const BADGE_CATEGORIES: readonly BadgeCategory[] = ['milestone', 'skill', 'play', 'habit'];

const TIER_RANK: Readonly<Record<BadgeTier, number>> = { bronze: 1, silver: 2, gold: 3 };

/** One badge's My Den display state, derived from every `EarnedBadge` row for its id. */
interface BadgeDisplay {
  readonly earned: boolean;
  readonly tier?: BadgeTier;
  /** Any not-yet-seen row for this badge (rewards.md §1 "new" dot). */
  readonly isNew: boolean;
  /** The next threshold not yet reached (locked, or a lower tier already earned); `undefined` once maxed. */
  readonly nextThreshold?: number;
  readonly latestId?: string;
}

function badgeDisplay(def: BadgeDef, earnedBadges: readonly EarnedBadge[]): BadgeDisplay {
  const entries = earnedBadges.filter((badge) => badge.badgeId === def.id);
  const best = entries.reduce<EarnedBadge | undefined>((current, entry) => {
    if (!current) return entry;
    const currentRank = current.tier ? TIER_RANK[current.tier] : 0;
    const entryRank = entry.tier ? TIER_RANK[entry.tier] : 0;
    return entryRank > currentRank ? entry : current;
  }, undefined);
  const nextThreshold = def.condition.thresholds[entries.length];
  return {
    earned: best !== undefined,
    tier: best?.tier,
    isNew: entries.some((entry) => !entry.seen),
    nextThreshold,
    latestId: best?.id,
  };
}

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
  const gameRecords = useAppStore((state) => state.gameRecords);
  const journey = useAppStore((state) => state.journey);
  const goToHome = useAppStore((state) => state.goToHome);
  const earnedBadges = useAppStore((state) => state.earnedBadges);
  const streak = useAppStore((state) => state.streak);
  const markBadgeSeen = useAppStore((state) => state.markBadgeSeen);

  const bubbleText = t('den.owl-line');
  const replay = useNarratedText(services.narrator, bubbleText);

  if (!profile || !journey) {
    return <main className="min-h-screen bg-cream" />;
  }

  const friends = animalFriends(journey.lessons, progress);
  const ladder = rankLadder(journey.catalog, journey.lessons, progress);
  const stars = totalStars(progress);
  const gamesWon = gameRecords.filter((record) => record.result === 'win').length;
  const friendGames = friendGamesPlayed(gameRecords);

  const badgeDefs = services.deps.content.badges?.() ?? [];

  function speakBadge(text: string): void {
    services.narrator.cancel();
    void services.narrator.speak(text);
  }

  function tapBadge(def: BadgeDef, display: BadgeDisplay, spokenName: string): void {
    if (display.earned) {
      const tierName = display.tier ? `, ${t(`tier.${display.tier}`)}` : '';
      speakBadge(`${spokenName}${tierName}`);
      if (display.isNew && display.latestId) {
        void markBadgeSeen(display.latestId);
      }
      return;
    }
    const condition = tContent(t, def.conditionKey, { count: display.nextThreshold ?? 0 });
    speakBadge(`${spokenName}. ${condition}`);
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-cream px-4 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={tContent(t, 'journey:ui.back')}
          onClick={goToHome}
          className="tap-raised flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-card text-ink"
        >
          <BackIcon />
        </button>
        <h1 className="flex-grow truncate font-display text-2xl text-ink sm:text-3xl">
          {t('den.title', { name: profile.nickname })}
        </h1>
        <StarsPill count={stars} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SpeechBubble text={bubbleText} avatarClassName="h-12 w-12" bubbleClassName="text-lg" />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>

      <div className="flex flex-wrap gap-2">
        <InfoPill
          role="img"
          aria-label={t('den.games-won', { count: gamesWon })}
          className="h-10 w-fit text-sm font-extrabold text-ink"
        >
          <span aria-hidden="true">{t('den.games-won', { count: gamesWon })}</span>
        </InfoPill>
        <InfoPill
          role="img"
          aria-label={t('den.games-with-friends', { count: friendGames })}
          className="h-10 w-fit text-sm font-extrabold text-ink"
        >
          <span aria-hidden="true">{t('den.games-with-friends', { count: friendGames })}</span>
        </InfoPill>
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
                  className={`info-flat flex items-center gap-3 rounded-xl px-3 py-2 ${
                    current ? 'bg-[#E3F1EA]' : ''
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

      {/* M4.4: badges + streak, its own section (kept apart from the rank/friends row above so a
          "Games with friends" count added elsewhere in My Den merges cleanly). */}
      {/* Flat, no border (docs/screens.md §1 "Cards that contain buttons", v1.1.0 part B): this
          panel's own content is a grid of raised badge tiles, so a bordered outer card would read
          as a second, bigger button around them. */}
      <div className="info-flat flex flex-col gap-4 rounded-[2rem] bg-[#F3EDE0] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink sm:text-2xl">{t('badges.heading')}</h2>
          {streak && streak.current >= 1 ? (
            <div
              role="img"
              aria-label={t('streak.current', { count: streak.current })}
              className="flex items-center gap-3"
            >
              <StreakPill days={streak.current} />
              <span className="text-sm font-bold text-muted">
                {t('streak.best', { count: streak.best })}
              </span>
            </div>
          ) : (
            <span className="text-sm font-bold text-muted">{t('streak.none')}</span>
          )}
        </div>

        {BADGE_CATEGORIES.map((category) => {
          const defs = badgeDefs.filter((def) => def.category === category);
          if (defs.length === 0) return null;
          return (
            <div key={category} className="flex flex-col gap-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">
                {t(`badges.category-${category}`)}
              </h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {defs.map((def) => {
                  const display = badgeDisplay(def, earnedBadges);
                  const name = tContent(t, def.nameKey);
                  const label = display.earned
                    ? display.tier
                      ? t('badges.tile-earned-tier', { name, tier: t(`tier.${display.tier}`) })
                      : t('badges.tile-earned', { name })
                    : t('badges.tile-locked', {
                        name,
                        condition: tContent(t, def.conditionKey, {
                          count: display.nextThreshold ?? 0,
                        }),
                      });
                  return (
                    <li key={def.id}>
                      <button
                        type="button"
                        aria-label={label}
                        onClick={() => {
                          tapBadge(def, display, name);
                        }}
                        className={`tap-raised relative flex min-h-16 w-full flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center ${
                          display.earned ? 'bg-white' : 'bg-[#F3EDE0]'
                        }`}
                      >
                        {display.isNew && (
                          <span
                            aria-hidden="true"
                            className="absolute right-2 top-2 rounded-full bg-today px-2 py-0.5 text-[10px] font-extrabold text-white"
                          >
                            {t('badges.new-dot')}
                          </span>
                        )}
                        <BadgeIcon
                          tier={display.tier}
                          locked={!display.earned}
                          className="h-12 w-12"
                        />
                        <span
                          className={`text-xs font-extrabold ${display.earned ? 'text-ink' : 'text-muted'}`}
                        >
                          {name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
