import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConceptStats, Lesson } from '@learn/platform-core';
import { isDue, isWeak, lessonStatus } from '@learn/platform-core';
import { useAppStore, useServices } from '../app/store.ts';
import { avatarName, tContent } from '../content-text.ts';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { WarmUpIcon } from './ds/icons.tsx';
import { tapClass } from './ds/tap.ts';
import { BlankScreen, Screen, ScreenHeader } from './ds/Screen.tsx';
import { AvatarBadge } from './ds/AvatarBadge.tsx';

/** One topic's last-10 accuracy, as a row of filled/empty dots (never red — errors are orange, not shown per-dot). */
function AccuracyDots({ recent }: { readonly recent: readonly boolean[] }): JSX.Element {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => {
        const result = recent[index];
        return (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${
              result === true ? 'bg-go' : result === false ? 'bg-today' : 'bg-[#E8DFC9]'
            }`}
          />
        );
      })}
    </div>
  );
}

interface TopicEntry {
  readonly conceptId: string;
  readonly lesson: Lesson;
  readonly stats?: ConceptStats;
}

/** Distinct concepts taught by a complete/mastered lesson, one row per concept (its earliest
 * lesson, by world/lesson order, gives the display title and character). */
function practiceTopics(
  lessons: readonly Lesson[],
  worldOrder: ReadonlyMap<string, number>,
  isComplete: (lesson: Lesson) => boolean,
  statsByConcept: ReadonlyMap<string, ConceptStats>,
): readonly TopicEntry[] {
  const sorted = [...lessons]
    .filter(isComplete)
    .sort(
      (a, b) =>
        (worldOrder.get(a.world) ?? 0) - (worldOrder.get(b.world) ?? 0) || a.order - b.order,
    );
  const byConcept = new Map<string, Lesson>();
  for (const lesson of sorted) {
    if (!byConcept.has(lesson.concept)) byConcept.set(lesson.concept, lesson);
  }
  return [...byConcept.entries()].map(([conceptId, lesson]) => ({
    conceptId,
    lesson,
    stats: statsByConcept.get(conceptId),
  }));
}

/** Practice: the daily warm-up card, and a topic run (5 tasks) for any concept already taught. */
export function PracticeScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const progress = useAppStore((state) => state.progress);
  const journey = useAppStore((state) => state.journey);
  const conceptStats = useAppStore((state) => state.conceptStats);
  const goToHome = useAppStore((state) => state.goToHome);
  const startPracticeWarmUp = useAppStore((state) => state.startPracticeWarmUp);
  const startPracticeTopic = useAppStore((state) => state.startPracticeTopic);

  const bubbleText = t('practice.owl-line');

  if (!profile || !journey) {
    return <BlankScreen />;
  }

  const now = services.deps.clock.now();
  const dueCount = conceptStats.filter((stats) => isDue(stats, now)).length;

  const progressByLesson = new Map(progress.map((entry) => [entry.lessonId, entry]));
  const worldOrder = new Map(
    journey.catalog.tracks.flatMap((track) =>
      track.worlds.map((world) => [world.id, world.order] as const),
    ),
  );
  const statsByConcept = new Map(conceptStats.map((stats) => [stats.conceptId, stats]));
  const topics = practiceTopics(
    journey.lessons,
    worldOrder,
    (lesson) => {
      const status = lessonStatus(lesson, progressByLesson.get(lesson.id));
      return status === 'complete' || status === 'mastered';
    },
    statsByConcept,
  );

  return (
    <Screen kind="page">
      <ScreenHeader
        action="back"
        actionLabel={t('practice.back')}
        onAction={goToHome}
        title={t('practice.title')}
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

      <button
        type="button"
        disabled={dueCount === 0}
        onClick={() => {
          void startPracticeWarmUp();
        }}
        className={tapClass(
          'custom',
          'none',
          'flex items-center gap-4 rounded-[2rem] bg-card p-5 text-left disabled:cursor-default disabled:opacity-70',
        )}
      >
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#FBE3D2]">
          <WarmUpIcon />
        </span>
        <span className="flex flex-col">
          <span className="font-display text-xl text-ink sm:text-2xl">
            {t('practice.warmup-card-title')}
          </span>
          <span className="text-sm font-bold text-muted">
            {dueCount === 0
              ? t('practice.warmup-all-done')
              : t('practice.warmup-due', { count: dueCount })}
          </span>
        </span>
      </button>

      <h2 className="font-display text-xl text-ink sm:text-2xl">{t('practice.topics-heading')}</h2>
      {topics.length === 0 ? (
        <p className="text-base text-muted">{t('practice.topics-empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topics.map(({ conceptId, lesson, stats }) => {
            const weak = stats !== undefined && isWeak(stats);
            const title = tContent(t, lesson.titleKey);
            return (
              <li key={conceptId}>
                <button
                  type="button"
                  onClick={() => {
                    void startPracticeTopic(conceptId);
                  }}
                  aria-label={
                    weak
                      ? `${title}, ${t('practice.weak-tag')}`
                      : `${title}, ${t('practice.topic-accuracy', {
                          correct: stats ? stats.recent.filter(Boolean).length : 0,
                          total: stats ? stats.recent.length : 0,
                        })}`
                  }
                  className={tapClass(
                    'custom',
                    'none',
                    'flex w-full items-center justify-between gap-4 rounded-3xl bg-card p-4 text-left',
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-display text-lg text-ink sm:text-xl">{title}</span>
                    <AccuracyDots recent={stats?.recent ?? []} />
                  </div>
                  {weak && (
                    <span className="flex-shrink-0 rounded-full bg-[#FBE3D2] px-3 py-1.5 text-xs font-extrabold text-[#7A3A10]">
                      {t('practice.weak-tag')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
