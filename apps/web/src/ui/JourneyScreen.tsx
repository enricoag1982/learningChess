import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Habitat,
  Journey,
  JourneyLessonStatus,
  Lesson,
  LessonProgress,
  MiniGame,
  World,
  WorldBossStatus,
  WorldStatus,
} from '@chess-kids/core';
import { lessonStars, worldLessons } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { characterName, tContent } from '../content-text.ts';
import { characterPieceOrNull } from './art/character-meta.ts';
import { firstLessonsByCharacter, journeyNodeLabel } from './lesson-character-labels.ts';
import { CharacterIcon, OwlIcon } from './art/characters.tsx';
import { StarsRow } from './StarsRow.tsx';
import { useMediaQuery } from './useMediaQuery.ts';

/** Pastel tint per habitat (app-structure.md §8: one habitat per world), for the map panel. */
const HABITAT_COLOR: Readonly<Record<Habitat, string>> = {
  meadow: '#E7F0D6',
  savannah: '#F6EBC9',
  jungle: '#D9EDD9',
  mountains: '#E6E2E0',
  river: '#DCEEF2',
  forest: '#DCE7D2',
  ocean: '#D9E8F5',
  arctic: '#E7F2F5',
};

/** Simplified node status: `complete` covers both `complete` and `mastered` (same node visual). */
type NodeStatus = 'locked' | 'current' | 'complete';

function nodeStatus(status: JourneyLessonStatus): NodeStatus {
  if (status === 'locked') return 'locked';
  if (status === 'available') return 'current';
  return 'complete';
}

/** Reward stars (1–3) from the percentage of a lesson's max stars earned (matches `CompleteStep`). */
function ratingStars(earned: number, max: number): 1 | 2 | 3 {
  if (max <= 0) return 1;
  const percent = earned / max;
  if (percent >= 0.9) return 3;
  if (percent >= 0.6) return 2;
  return 1;
}

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
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FlagIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3v18" stroke="#6E4A07" strokeWidth={2} strokeLinecap="round" />
      <path d="M6 4h13l-4 4 4 4H6z" fill="#E9A92B" />
    </svg>
  );
}

/** World boss node icon: outline while its boss is available, filled gold once it is won. */
function CrownIcon({ filled }: { readonly filled: boolean }): JSX.Element {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill={filled ? '#E9A92B' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 18h16l1-9-5 4-4-6-4 6-5-4z" />
      <path d="M4 18v2h16v-2" />
    </svg>
  );
}

/** A point in a 0–100 normalized coordinate space, matching the map's `viewBox`. */
interface NodePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A gentle winding "snake" of `count` points across the 0–100 normalized map: left-to-right and
 * oscillating vertically when `wide` (tablet landscape), bottom-to-top and oscillating
 * horizontally otherwise (phone / tablet portrait — same `lg` cut as `GameLayout`).
 */
function layoutNodes(count: number, wide: boolean): readonly NodePoint[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y: 50 }];
  // Neighbours alternate sides (zig-zag) so consecutive nodes never overlap, even with 8 nodes on
  // a phone; a small wiggle keeps the path organic.
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const side = i % 2 === 0 ? -1 : 1;
    const wiggle = 5 * Math.sin(i * 1.7);
    if (wide) {
      const x = 12 + 76 * t;
      const y = Math.min(84, Math.max(18, 52 - side * 20 + wiggle));
      return { x, y };
    }
    const y = 88 - 76 * t;
    const x = Math.min(80, Math.max(20, 50 + side * 22 + wiggle));
    return { x, y };
  });
}

/** Smooth Catmull-Rom curve through `points`, as a cubic-bezier SVG path. */
function smoothPath(points: readonly NodePoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${String(points[0]?.x)} ${String(points[0]?.y)}`;
  let d = `M ${String(points[0]?.x)} ${String(points[0]?.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${String(cp1x)} ${String(cp1y)}, ${String(cp2x)} ${String(cp2y)}, ${String(p2.x)} ${String(p2.y)}`;
  }
  return d;
}

/**
 * Default world to show: the one holding `journey.nextStep` (a lesson or a world boss), else the
 * first open one, else the first.
 */
function defaultWorldId(journey: Journey): string | undefined {
  if (journey.nextStep?.kind === 'lesson') return journey.nextStep.lesson.world;
  if (journey.nextStep?.kind === 'world-boss') return journey.nextStep.world.id;
  const open = journey.worlds.find((w) => w.status === 'available' || w.status === 'mastered');
  return (open ?? journey.worlds[0])?.world.id;
}

export function JourneyScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const journey = useAppStore((state) => state.journey);
  const progress = useAppStore((state) => state.progress);
  const startLesson = useAppStore((state) => state.startLesson);
  const startMiniGame = useAppStore((state) => state.startMiniGame);
  const goToHome = useAppStore((state) => state.goToHome);

  const [selectedWorldId, setSelectedWorldId] = useState<string | undefined>(undefined);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  if (!journey) {
    return <main className="min-h-screen bg-cream" />;
  }

  const worldId = selectedWorldId ?? defaultWorldId(journey);
  const current = journey.worlds.find((w) => w.world.id === worldId) ?? journey.worlds[0];
  const mainTrack = journey.catalog.tracks.find((track) => track.kind === 'main');
  const mainWorlds = journey.worlds.filter((w) => w.world.track === mainTrack?.id);
  const branchWorlds = journey.worlds.filter((w) => w.world.track !== mainTrack?.id);
  const isWorldOne = (world: World): boolean => world.track === mainTrack?.id && world.order === 1;
  const worldOrder = new Map(
    journey.catalog.tracks.flatMap((track) =>
      track.worlds.map((world) => [world.id, world.order] as const),
    ),
  );
  const firstLessonOfCharacter = firstLessonsByCharacter(journey.lessons, worldOrder);

  function selectWorld(id: string): void {
    setSelectedWorldId(id);
    setLockedMessage(null);
  }

  function activateLesson(
    lesson: Lesson,
    world: World,
    lessons: readonly Lesson[],
    statuses: ReadonlyMap<string, JourneyLessonStatus>,
  ): void {
    const status = statuses.get(lesson.id);
    if (status === 'locked') {
      const index = lessons.findIndex((entry) => entry.id === lesson.id);
      const previous = index > 0 ? lessons[index - 1] : undefined;
      if (!previous) return;
      // Owl-taught lessons (no piece character) are named by their title.
      const name =
        characterPieceOrNull(previous.character) === null
          ? tContent(t, previous.titleKey)
          : characterName(t, previous.character);
      const message = tContent(t, 'journey:ui.finish-first', { name });
      setLockedMessage(message);
      services.narrator.cancel();
      void services.narrator.speak(message);
      return;
    }
    setLockedMessage(null);
    void startLesson(lesson.id);
  }

  function activateBoss(bossStatus: WorldBossStatus, miniGameId: string): void {
    if (bossStatus !== 'available' && bossStatus !== 'won') return;
    setLockedMessage(null);
    startMiniGame(miniGameId, 'journey');
  }

  const lessonsOfCurrent = current ? worldLessons(current.world, journey.lessons) : [];
  const bossMiniGame: MiniGame | undefined =
    current?.world.boss !== undefined
      ? services.deps.content.minigame(current.world.boss)
      : undefined;
  const worldTitle = current
    ? tContent(t, 'journey:ui.world-heading', {
        order: current.world.order,
        name: tContent(t, current.world.titleKey),
      })
    : '';
  const habitatName = current ? tContent(t, `journey:habitats.${current.world.habitat}`) : '';
  const worldTotals = lessonsOfCurrent.reduce(
    (acc, lesson) => {
      const { earned, max } = lessonStars(
        lesson,
        progress.find((p) => p.lessonId === lesson.id),
      );
      return { earned: acc.earned + earned, max: acc.max + max };
    },
    { earned: 0, max: 0 },
  );

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
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-2xl text-ink sm:text-3xl">{worldTitle}</span>
          <span className="text-sm text-muted sm:text-base">
            {habitatName}
            {worldTotals.max > 0 &&
              ` · ${tContent(t, 'journey:ui.world-stars', { earned: worldTotals.earned, max: worldTotals.max })}`}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:w-64 lg:flex-none lg:flex-col lg:overflow-visible lg:pb-0">
          {mainWorlds.map(({ world, status }) => (
            <WorldRow
              key={world.id}
              name={tContent(t, world.titleKey)}
              order={world.order}
              status={status}
              selected={world.id === worldId}
              onSelect={() => {
                selectWorld(world.id);
              }}
            />
          ))}
          <div className="mt-1 flex items-center px-2 text-xs font-extrabold tracking-wide text-muted lg:mt-2 lg:text-[13px] lg:uppercase">
            {tContent(t, 'journey:ui.paths-after-basics')}
          </div>
          {branchWorlds.map(({ world, status }) => (
            <WorldRow
              key={world.id}
              name={tContent(t, world.titleKey)}
              order={world.order}
              status={status}
              selected={world.id === worldId}
              onSelect={() => {
                selectWorld(world.id);
              }}
              muted
            />
          ))}
        </div>

        <div
          className="relative min-h-[360px] flex-1 overflow-hidden rounded-[2rem]"
          style={{ background: current ? HABITAT_COLOR[current.world.habitat] : undefined }}
        >
          {current?.status === 'coming-soon' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
              <span className="font-display text-2xl text-ink">
                {tContent(t, 'journey:ui.coming-soon-title')}
              </span>
              <span className="text-base text-muted">
                {tContent(t, 'journey:ui.coming-soon-message')}
              </span>
            </div>
          )}
          {current?.status === 'locked' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/10 px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-muted">
                <LockIcon />
              </div>
              <span className="max-w-xs text-base font-semibold text-muted">
                {tContent(t, 'journey:ui.locked-world-message')}
              </span>
            </div>
          )}
          {current && (current.status === 'available' || current.status === 'mastered') && (
            <WorldMap
              lessons={lessonsOfCurrent}
              statuses={journey.statuses}
              progress={progress}
              isWorldOne={isWorldOne(current.world)}
              firstLessonOfCharacter={firstLessonOfCharacter}
              onActivate={(lesson) => {
                activateLesson(lesson, current.world, lessonsOfCurrent, journey.statuses);
              }}
              bossMiniGame={bossMiniGame}
              bossStatus={current.bossStatus}
              onActivateBoss={() => {
                if (current.world.boss !== undefined) {
                  activateBoss(current.bossStatus, current.world.boss);
                }
              }}
            />
          )}

          {lockedMessage && (
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-3xl border-2 border-line bg-card px-4 py-3 shadow">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-[#E9DFF3] p-1.5">
                <OwlIcon />
              </div>
              <p className="font-display text-lg text-ink">{lockedMessage}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function WorldRow({
  name,
  order,
  status,
  selected,
  onSelect,
  muted = false,
}: {
  readonly name: string;
  readonly order: number;
  readonly status: WorldStatus;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly muted?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const dim = status === 'locked' || status === 'coming-soon';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-16 min-w-[180px] flex-shrink-0 items-center gap-3 rounded-2xl border-2 px-3 lg:min-w-0 lg:w-full ${
        selected
          ? 'border-go bg-white'
          : muted
            ? 'border-transparent bg-[#F3EDE0]'
            : 'border-transparent bg-transparent'
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
          dim ? 'bg-[#E8DFC9] text-muted' : 'bg-go text-white'
        }`}
      >
        {order}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-left text-sm font-extrabold ${
          dim ? 'text-muted' : 'text-ink'
        }`}
      >
        {name}
      </span>
      {status === 'mastered' && (
        <span className="flex-shrink-0 text-go">
          <CheckIcon />
        </span>
      )}
      {status === 'locked' && (
        <span className="flex-shrink-0 text-muted">
          <LockIcon />
        </span>
      )}
      {status === 'coming-soon' && (
        <span className="flex-shrink-0 text-xs font-bold text-muted">
          {tContent(t, 'journey:ui.coming-soon')}
        </span>
      )}
    </button>
  );
}

function WorldMap({
  lessons,
  statuses,
  progress,
  isWorldOne,
  firstLessonOfCharacter,
  onActivate,
  bossMiniGame,
  bossStatus,
  onActivateBoss,
}: {
  readonly lessons: readonly Lesson[];
  readonly statuses: ReadonlyMap<string, JourneyLessonStatus>;
  readonly progress: readonly LessonProgress[];
  readonly isWorldOne: boolean;
  /** First lesson id per character (curriculum order), for a repeated character's node label. */
  readonly firstLessonOfCharacter: ReadonlyMap<string, string>;
  readonly onActivate: (lesson: Lesson) => void;
  /** This world's boss content, when it has one (`bossStatus` is then not `'none'`). */
  readonly bossMiniGame: MiniGame | undefined;
  readonly bossStatus: WorldBossStatus;
  readonly onActivateBoss: () => void;
}): JSX.Element {
  const wide = useMediaQuery('(min-width: 1024px)');
  const hasBoss = bossMiniGame !== undefined && bossStatus !== 'none';
  const points = layoutNodes(lessons.length + (hasBoss ? 1 : 0), wide);
  const pathD = smoothPath(points);
  const bossPoint = hasBoss ? points[points.length - 1] : undefined;

  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#E3CF9C"
            strokeWidth={3.2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {lessons.map((lesson, index) => {
        const point = points[index];
        if (!point) return null;
        return (
          <LessonNode
            key={lesson.id}
            lesson={lesson}
            status={statuses.get(lesson.id) ?? 'locked'}
            progress={progress.find((p) => p.lessonId === lesson.id)}
            isWorldOne={isWorldOne}
            firstLessonOfCharacter={firstLessonOfCharacter}
            point={point}
            onActivate={() => {
              onActivate(lesson);
            }}
          />
        );
      })}
      {hasBoss && bossPoint && (
        <BossNode
          miniGame={bossMiniGame}
          status={bossStatus}
          point={bossPoint}
          onActivate={onActivateBoss}
        />
      )}
    </div>
  );
}

function LessonNode({
  lesson,
  status: statusValue,
  progress,
  isWorldOne,
  firstLessonOfCharacter,
  point,
  onActivate,
}: {
  readonly lesson: Lesson;
  readonly status: JourneyLessonStatus;
  readonly progress: LessonProgress | undefined;
  readonly isWorldOne: boolean;
  /** First lesson id per character (curriculum order), for a repeated character's node label. */
  readonly firstLessonOfCharacter: ReadonlyMap<string, string>;
  readonly point: NodePoint;
  readonly onActivate: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const status = nodeStatus(statusValue);
  const { earned, max } = lessonStars(lesson, progress);
  const rating = status === 'complete' ? ratingStars(earned, max) : 0;
  const bossWon = (progress?.bossStars ?? 0) >= 2;

  // Owl-taught lessons (World 1: no piece character) are labelled by their title, e.g. "Squares";
  // a piece character's first lesson by the character's name ("Rhino"), a later lesson of the same
  // character (M3.5: "Promotion") by its own title ("Caterpillar Transforms!"), so two nodes never
  // show the same label (`journeyNodeLabel`, like Play's `unlockLabel`).
  const piece = characterPieceOrNull(lesson.character);
  const isFirstOfCharacter = firstLessonOfCharacter.get(lesson.character) === lesson.id;
  const characterLabel = journeyNodeLabel(t, lesson, firstLessonOfCharacter);
  const nameLabel =
    piece !== null && isFirstOfCharacter
      ? tContent(t, 'journey:ui.character-piece', {
          character: characterLabel,
          piece: tContent(t, `piece.${piece}`),
        })
      : characterLabel;
  const statusWord = tContent(t, `journey:ui.status-${status}`);
  const accessibleName =
    status === 'complete'
      ? tContent(t, 'journey:ui.node-name-stars', {
          name: nameLabel,
          status: statusWord,
          count: rating,
        })
      : tContent(t, 'journey:ui.node-name', { name: nameLabel, status: statusWord });

  const size = status === 'current' ? 'h-24 w-24' : 'h-20 w-20';
  const colors =
    status === 'complete'
      ? 'bg-go text-white'
      : status === 'current'
        ? 'bg-today text-white'
        : 'bg-[#E8DFC9] text-muted';

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${String(point.x)}%`, top: `${String(point.y)}%` }}
    >
      {status === 'current' && (
        <span className="pointer-events-none absolute h-28 w-28 animate-ping rounded-full border-4 border-today/50" />
      )}
      <button
        type="button"
        onClick={onActivate}
        aria-label={accessibleName}
        className={`relative flex flex-shrink-0 items-center justify-center rounded-full border-4 border-cream ${size} ${colors}`}
      >
        {status === 'locked' ? (
          <LockIcon />
        ) : isWorldOne ? (
          <span className="h-12 w-12">
            <OwlIcon />
          </span>
        ) : (
          <span className="h-12 w-12">
            <CharacterIcon character={lesson.character} />
          </span>
        )}
        {bossWon && (
          <span className="absolute -right-1 -top-1 rounded-full bg-white p-1">
            <FlagIcon />
          </span>
        )}
      </button>
      <span className="line-clamp-2 max-w-[8rem] rounded-2xl bg-white px-2 py-0.5 text-center text-xs leading-tight font-extrabold text-ink">
        {characterLabel}
      </span>
      {status === 'complete' && <StarsRow earned={rating} size="1rem" />}
    </div>
  );
}

/**
 * A world boss's node, shown after its world's last lesson node (crown badge). Status style
 * mirrors `LessonNode`: `locked` (grey, lock icon), `available` (pulsing "current" style — this is
 * always the Journey's next step while unwon, since a world's lessons gate its boss), `won`
 * (solid, filled gold crown). Tapping a locked boss does nothing; `available`/`won` calls
 * `onActivate` (starts the mini-game session, same as the Play screen).
 */
function BossNode({
  miniGame,
  status,
  point,
  onActivate,
}: {
  readonly miniGame: MiniGame;
  readonly status: Exclude<WorldBossStatus, 'none'>;
  readonly point: NodePoint;
  readonly onActivate: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const title = tContent(t, miniGame.titleKey);
  const statusWord = tContent(t, `journey:ui.boss-status-${status}`);
  const accessibleName = tContent(t, 'journey:ui.world-boss-name', { title, status: statusWord });

  const nodeStatusValue: NodeStatus =
    status === 'locked' ? 'locked' : status === 'won' ? 'complete' : 'current';
  const size = nodeStatusValue === 'current' ? 'h-24 w-24' : 'h-20 w-20';
  const colors =
    nodeStatusValue === 'complete'
      ? 'bg-go text-white'
      : nodeStatusValue === 'current'
        ? 'bg-today text-white'
        : 'bg-[#E8DFC9] text-muted';

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${String(point.x)}%`, top: `${String(point.y)}%` }}
    >
      {nodeStatusValue === 'current' && (
        <span className="pointer-events-none absolute h-28 w-28 animate-ping rounded-full border-4 border-today/50" />
      )}
      <button
        type="button"
        onClick={onActivate}
        aria-label={accessibleName}
        className={`relative flex flex-shrink-0 items-center justify-center rounded-full border-4 border-cream ${size} ${colors}`}
      >
        {status === 'locked' ? (
          <LockIcon />
        ) : (
          <span className="h-12 w-12">
            <CrownIcon filled={status === 'won'} />
          </span>
        )}
      </button>
      <span className="max-w-[8rem] rounded-2xl bg-white px-2 py-0.5 text-center text-xs leading-tight font-extrabold text-ink">
        {title}
      </span>
    </div>
  );
}
