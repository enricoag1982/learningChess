import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { animalFriends, totalStars } from '@learn/platform-core';
import { useAppStore } from '../app/store.ts';
import { usePack } from '../app/subject.ts';
import { characterName, tContent } from '../content-text.ts';
import { CharacterIcon } from './art/characters.tsx';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { StarsRow } from './StarsRow.tsx';
import { tapClass } from './ds/tap.ts';
import { BlankScreen } from './ds/Screen.tsx';

/** Today session's closing screen (domain-model.md §3.3): stars earned, any new animal friend, a
 * rank-up, and Owl's line — then back to Home. */
export function SessionSummaryScreen(): JSX.Element {
  const { t } = useTranslation();
  const characters = usePack().core.characters;
  const journey = useAppStore((state) => state.journey);
  const progress = useAppStore((state) => state.progress);
  const startTotalStars = useAppStore((state) => state.todaySessionStartTotalStars);
  const startFriends = useAppStore((state) => state.todaySessionStartFriends);
  const startRankId = useAppStore((state) => state.todaySessionStartRankId);
  const finishToday = useAppStore((state) => state.finishToday);

  const bubbleText = t('session.summary-closing');

  if (!journey) {
    return <BlankScreen />;
  }

  const starsEarned = Math.max(0, totalStars(progress) - startTotalStars);
  const startFriendChars = new Set(
    startFriends.filter((friend) => friend.earned).map((friend) => friend.character),
  );
  const newFriends = animalFriends(journey.lessons, progress, characters).filter(
    (friend) => friend.earned && !startFriendChars.has(friend.character),
  );
  const newRank = journey.rank && journey.rank.id !== startRankId ? journey.rank : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-cream px-6 py-10 text-center">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{t('session.summary-title')}</h1>
      <StarsRow earned={Math.min(3, starsEarned)} max={3} size="4rem" animate />
      <div className="rounded-full bg-[#FBEFD3] px-6 py-3 font-display text-lg font-bold text-[#6E4A07]">
        {t('complete.stars-pill', { count: starsEarned })}
      </div>

      {newRank && (
        <div className="info-flat flex w-full max-w-md items-center gap-4 rounded-3xl bg-card p-5 text-left">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[#DCEFE3] font-display text-2xl text-[#1F5A41]">
            ★
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {t('session.summary-new-rank')}
            </span>
            <span className="font-display text-xl text-ink">
              {tContent(t, `journey:ranks.${newRank.id}`)}
            </span>
          </div>
        </div>
      )}

      {newFriends.map((friend) => (
        <div
          key={friend.character}
          className="info-flat flex w-full max-w-md items-center gap-4 rounded-3xl bg-card p-5 text-left"
        >
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EFE4F7] p-2">
            <CharacterIcon character={friend.character} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {t('session.summary-new-friend')}
            </span>
            <span className="font-display text-xl text-ink">
              {characterName(t, friend.character)}
            </span>
          </div>
        </div>
      ))}

      <NarratedBubble
        text={bubbleText}
        layout="center-row"
        avatarClassName="h-12 w-12"
        bubbleClassName="text-lg"
      />

      <button
        type="button"
        onClick={finishToday}
        className={tapClass(
          'custom',
          'go',
          'mt-auto h-20 w-full max-w-lg rounded-3xl font-display text-xl font-semibold',
        )}
      >
        {t('session.summary-done')}
      </button>
    </main>
  );
}
