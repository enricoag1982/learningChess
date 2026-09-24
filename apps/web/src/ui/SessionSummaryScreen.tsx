import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { animalFriends, totalStars } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { characterName, tContent } from '../content-text.ts';
import { CharacterIcon } from './art/characters.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { StarsRow } from './StarsRow.tsx';
import { useNarratedText } from './useNarratedText.ts';

/**
 * Today session's closing screen (domain-model.md §3.3 "session summary"): stars earned this
 * session (against the snapshot `startToday` took), any newly-earned animal friend, a rank-up, and
 * Owl's "see you tomorrow" line — then back to Home (`finishToday`).
 */
export function SessionSummaryScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const journey = useAppStore((state) => state.journey);
  const progress = useAppStore((state) => state.progress);
  const startTotalStars = useAppStore((state) => state.todaySessionStartTotalStars);
  const startFriends = useAppStore((state) => state.todaySessionStartFriends);
  const startRankId = useAppStore((state) => state.todaySessionStartRankId);
  const finishToday = useAppStore((state) => state.finishToday);

  const bubbleText = t('session.summary-closing');
  const replay = useNarratedText(services.narrator, bubbleText);

  if (!journey) {
    return <main className="min-h-screen bg-cream" />;
  }

  const starsEarned = Math.max(0, totalStars(progress) - startTotalStars);
  const startFriendChars = new Set(
    startFriends.filter((friend) => friend.earned).map((friend) => friend.character),
  );
  const newFriends = animalFriends(journey.lessons, progress).filter(
    (friend) => friend.earned && !startFriendChars.has(friend.character),
  );
  const newRank = journey.rank && journey.rank.id !== startRankId ? journey.rank : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-cream px-6 py-10 text-center">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{t('session.summary-title')}</h1>
      <StarsRow earned={Math.min(3, starsEarned)} max={3} size="4rem" animate />
      <div className="rounded-full bg-[#FBEFD3] px-6 py-3 font-display text-lg font-bold text-[#6E4A07]">
        {t('complete.stars-pill', { count: starsEarned })}
      </div>

      {newRank && (
        <div className="flex w-full max-w-md items-center gap-4 rounded-3xl border-2 border-line bg-card p-5 text-left">
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
          className="flex w-full max-w-md items-center gap-4 rounded-3xl border-2 border-line bg-card p-5 text-left"
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

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <SpeechBubble text={bubbleText} avatarClassName="h-12 w-12" bubbleClassName="text-lg" />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>

      <button
        type="button"
        onClick={finishToday}
        className="mt-auto h-20 w-full max-w-lg rounded-3xl bg-go font-display text-xl font-semibold text-white"
      >
        {t('session.summary-done')}
      </button>
    </main>
  );
}
