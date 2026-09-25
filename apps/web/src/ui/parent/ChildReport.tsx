import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ChildReport, GameRecord, Lesson, Profile } from '@chess-kids/core';
import { bot, buildChildReport } from '@chess-kids/core';
import { useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { avatarBackground } from '../art/avatar-meta.ts';
import { AvatarIcon } from '../art/avatars.tsx';
import { RankPill } from '../RankPill.tsx';
import { ChevronLeftIcon, ChevronRightIcon } from './parent-icons.tsx';
import { PARENT_INFO_PANEL, PARENT_NOTE, PARENT_SECONDARY_BUTTON } from './parent-styles.ts';

const DATE_FORMAT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

/** `'2026-01-05'` -> `'Jan 5'`. */
function formatDate(iso: string): string {
  // A plain `YYYY-MM-DD` date string parses as UTC midnight; read back with UTC fields so the
  // shown day never shifts a day off in a negative-UTC-offset timezone (same reasoning
  // `domain/session-log.ts`'s own local-day helpers document, the other way around).
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return DATE_FORMAT.format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)));
}

function opponentLabel(
  t: TFunction,
  opponent: string,
  profilesById: ReadonlyMap<string, Profile>,
): string {
  if (opponent === 'guest') return t('friend-play.guest');
  if (opponent.startsWith('computer:')) {
    const level = Number(opponent.slice('computer:'.length));
    const name = bot.BOT_LEVELS.find((entry) => entry.level === level)?.name;
    return name ? t(`boss.versus.bot-name.${name}`) : opponent;
  }
  if (opponent.startsWith('profile:')) {
    const id = opponent.slice('profile:'.length);
    return profilesById.get(id)?.nickname ?? t('parent.report.opponent-friend');
  }
  return opponent;
}

function resultLabel(t: TFunction, result: GameRecord['result']): string {
  switch (result) {
    case 'win':
      return t('parent.report.result-win');
    case 'loss':
      return t('parent.report.result-loss');
    case 'draw':
      return t('parent.report.result-draw');
    case 'abandoned':
      return t('parent.report.result-abandoned');
  }
}

/** First lesson teaching `conceptId` (every lesson's exercises share its own top-level concept, by
 * content convention — same lookup `PracticeScreen` already uses for a topic's display name). */
function lessonForConcept(lessons: readonly Lesson[], conceptId: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.concept === conceptId);
}

/** `null`/off -> "Off", else "N min" — the same wording `ChildSettings`'s own chips use. */
function limitLabel(t: TFunction, minutes: number | null): string {
  return minutes === null
    ? t('parent.daily-limit-off')
    : t('parent.daily-limit-minutes', { count: minutes });
}

/**
 * One-line summary of the active time-control rules (M7.1, app-structure.md §13), e.g. "Mon–Fri
 * 30 min · Sat–Sun 60 min · until 20:00" — shown under the minutes-per-day chart, alongside (not
 * replacing) its own existing "Daily limit: N min" line. `null` when nothing is set (no limit, no
 * allowed-hours window) — nothing to show.
 */
function activeRulesLine(t: TFunction, report: ChildReport): string | null {
  const parts: string[] = [];
  if (report.weekendLimitMinutes !== undefined) {
    parts.push(
      t('parent.report.rules-weekday', { limit: limitLabel(t, report.dailyLimitMinutes) }),
    );
    parts.push(
      t('parent.report.rules-weekend', { limit: limitLabel(t, report.weekendLimitMinutes) }),
    );
  } else if (report.dailyLimitMinutes !== null) {
    parts.push(
      t('parent.report.rules-everyday', { limit: limitLabel(t, report.dailyLimitMinutes) }),
    );
  }
  if (report.playUntil != null)
    parts.push(t('parent.report.rules-until', { time: report.playUntil }));
  if (report.playFrom != null) parts.push(t('parent.report.rules-from', { time: report.playFrom }));
  return parts.length > 0 ? parts.join(' · ') : null;
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export interface ChildReportScreenProps {
  readonly profileId: string;
  readonly profiles: readonly Profile[];
  readonly onBack: () => void;
  readonly onOpenSettings: () => void;
}

/** Parent area "child report" (app-structure.md §11): progress by world, concept accuracy + weak
 * list, minutes per day, games, badges, assessments — read-only, own screen between the Overview
 * and the child's Settings. */
export function ChildReportScreen({
  profileId,
  profiles,
  onBack,
  onOpenSettings,
}: ChildReportScreenProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [report, setReport] = useState<ChildReport | null>(null);

  // The caller remounts this component with `key={profileId}` (`ParentAreaScreen.tsx`) when the
  // report opens for a different child, so `report` always starts fresh at `null` — no need for a
  // synchronous `setReport(null)` reset inside the effect body for a `profileId` change.
  useEffect(() => {
    let cancelled = false;
    void buildChildReport(services.deps, profileId).then((loaded) => {
      if (!cancelled) setReport(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [services, profileId]);

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const lessons = services.deps.content.lessons();
  const badgeDefs = services.deps.content.badges?.() ?? [];
  const maxMinutes = Math.max(1, ...(report?.minutesByDay.map((day) => day.minutes) ?? [0]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('parent.back')}
          className="tap-raised flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-card text-ink"
        >
          <ChevronLeftIcon />
        </button>
        {report && (
          <>
            <span
              className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full p-1.5"
              style={{ backgroundColor: avatarBackground(report.profile.avatar) }}
            >
              <AvatarIcon avatar={report.profile.avatar} />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-base font-extrabold text-ink">{report.profile.nickname}</span>
              <RankPill rank={report.rank} compact />
            </div>
          </>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`${PARENT_SECONDARY_BUTTON} flex-shrink-0`}
        >
          {t('parent.settings')}
          <ChevronRightIcon />
        </button>
      </div>

      {!report ? (
        <p className={PARENT_INFO_PANEL}>{t('parent.report.loading')}</p>
      ) : (
        <>
          <Section title={t('parent.report.progress-heading')}>
            <ul className="flex flex-col gap-2">
              {/* A branch-track world with no authored lessons yet (docs/curriculum.md "Next")
                  would only ever show as a noisy "0/0" row — skip it until it has content. */}
              {report.worlds
                .filter((entry) => entry.lessonsTotal > 0)
                .map((entry) => (
                  <li
                    key={entry.world.id}
                    className={`${PARENT_INFO_PANEL} flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3`}
                  >
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm font-bold text-ink">
                        {tContent(t, 'journey:ui.world-heading', {
                          order: entry.world.order,
                          name: tContent(t, entry.world.titleKey),
                        })}
                      </span>
                      {/* "Intro skipped" (playtest 2): one line per lesson that had a Story/Demo/Try
                          "Skip" tap, small muted text — never shown when none did. */}
                      {entry.skippedIntroLessons.length > 0 && (
                        <span className="text-xs text-muted">
                          {t('parent.report.intro-skipped', {
                            list: entry.skippedIntroLessons
                              .map((lesson) => tContent(t, lesson.titleKey))
                              .join(', '),
                          })}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="text-xs text-muted">
                        {t('parent.report.lessons-complete', {
                          complete: entry.lessonsComplete,
                          total: entry.lessonsTotal,
                        })}
                      </span>
                      <span className="text-xs text-muted">
                        {t('parent.report.lessons-mastered', { count: entry.lessonsMastered })}
                      </span>
                      <span className="text-xs font-bold text-[#8C6A1E]">
                        {t('parent.report.stars', {
                          earned: entry.starsEarned,
                          max: entry.starsMax,
                        })}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </Section>

          <Section title={t('parent.report.concepts-heading')}>
            {report.weakConcepts.length > 0 && (
              <p className={PARENT_NOTE}>
                {t('parent.report.needs-practice', {
                  list: report.weakConcepts
                    .map((id) => {
                      const lesson = lessonForConcept(lessons, id);
                      return lesson ? tContent(t, lesson.titleKey) : id;
                    })
                    .join(', '),
                })}
              </p>
            )}
            {report.conceptAccuracy.length === 0 ? (
              <p className={PARENT_INFO_PANEL}>{t('parent.report.concepts-empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.conceptAccuracy.map((entry) => {
                  const lesson = lessonForConcept(lessons, entry.conceptId);
                  const name = lesson ? tContent(t, lesson.titleKey) : entry.conceptId;
                  return (
                    <li
                      key={entry.conceptId}
                      className={`${PARENT_INFO_PANEL} flex items-center gap-3`}
                    >
                      <span className="flex-1 text-sm font-bold text-ink">{name}</span>
                      <span className="text-xs text-muted">
                        {t('parent.report.accuracy', {
                          percent: Math.round(entry.accuracy * 100),
                          attempts: entry.attempts,
                        })}
                      </span>
                      {entry.weak && (
                        <span className="flex-shrink-0 rounded-full bg-[#FBE3D2] px-2 py-1 text-xs font-extrabold text-[#7A3A10]">
                          {t('parent.report.needs-practice-tag')}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={t('parent.report.minutes-heading')}>
            {report.dailyLimitMinutes !== null && (
              <p className={PARENT_NOTE}>
                {t('parent.report.minutes-limit', { count: report.dailyLimitMinutes })}
              </p>
            )}
            {activeRulesLine(t, report) !== null && (
              <p className={PARENT_NOTE}>{activeRulesLine(t, report)}</p>
            )}
            <ul className="flex flex-col gap-1">
              {report.minutesByDay.map((day) => (
                <li key={day.date} className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-12 flex-shrink-0">{formatDate(day.date)}</span>
                  <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-cream">
                    <span
                      className="block h-full rounded-full bg-info"
                      style={{ width: `${String((day.minutes / maxMinutes) * 100)}%` }}
                    />
                    {report.dailyLimitMinutes !== null &&
                      report.dailyLimitMinutes <= maxMinutes && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 w-0.5 bg-[#8C4012]"
                          style={{
                            left: `${String((report.dailyLimitMinutes / maxMinutes) * 100)}%`,
                          }}
                        />
                      )}
                  </span>
                  <span className="w-20 flex-shrink-0 text-right font-bold text-ink">
                    {t('parent.report.minutes', { count: day.minutes })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('parent.report.games-heading')}>
            {report.games.length === 0 ? (
              <p className={PARENT_INFO_PANEL}>{t('parent.report.games-empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.games.map((game) => (
                  <li key={game.id} className={`${PARENT_INFO_PANEL} flex items-center gap-3`}>
                    <span className="flex-1 text-sm font-bold text-ink">
                      {opponentLabel(t, game.opponent, profilesById)}
                    </span>
                    <span className="text-xs text-muted">{resultLabel(t, game.result)}</span>
                    <span className="text-xs text-muted">{formatDate(game.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('parent.report.badges-heading')}>
            {report.badges.length === 0 ? (
              <p className={PARENT_INFO_PANEL}>{t('parent.report.badges-empty')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {report.badges.map((badge) => {
                  const def = badgeDefs.find((entry) => entry.id === badge.badgeId);
                  const name = def ? tContent(t, def.nameKey) : badge.badgeId;
                  return (
                    <li
                      key={badge.id}
                      className="info-flat rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink"
                    >
                      {badge.tier ? `${name} (${t(`tier.${badge.tier}`)})` : name}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={t('parent.report.assessments-heading')}>
            {report.assessments.length === 0 ? (
              <p className={PARENT_INFO_PANEL}>{t('parent.report.assessments-empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.assessments.map((result) => (
                  <li key={result.id} className={`${PARENT_INFO_PANEL} flex items-center gap-3`}>
                    <span className="flex-1 text-sm font-bold text-ink">
                      {t(`parent.report.assessment-kind.${result.kind}`)}
                    </span>
                    <span className="text-xs text-muted">
                      {t('parent.report.assessment-score', {
                        correct: result.correct,
                        total: result.total,
                      })}
                    </span>
                    <span
                      className={`text-xs font-bold ${result.passed ? 'text-go' : 'text-muted'}`}
                    >
                      {t(
                        result.passed
                          ? 'parent.report.assessment-passed'
                          : 'parent.report.assessment-failed',
                      )}
                    </span>
                    <span className="text-xs text-muted">{formatDate(result.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
