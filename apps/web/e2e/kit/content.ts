import type { CompiledContent, Lesson, MiniGame, TracksCatalog, World } from '@chess-kids/core';
import {
  findWorld as coreFindWorld,
  mainTrackLessons,
  nextLesson,
  worldLessons,
} from '@chess-kids/core';
// Node's ESM loader requires this attribute for a JSON import; the content build validates the
// shape (see `bundled-content-source.ts`), so the cast below is a type conversion, not a check.
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import { characterPieceOrNull } from '../../src/ui/art/character-meta.ts';
import { contentText, interpolate } from './i18n.ts';

export const content: CompiledContent = rawContent as unknown as CompiledContent;
export const catalog: TracksCatalog = rawTracks as unknown as TracksCatalog;

export function findLesson(id: string): Lesson {
  const lesson = content.lessons.find((entry) => entry.id === id);
  if (!lesson) throw new Error(`fixture content is missing lesson "${id}"`);
  return lesson;
}

export function findMiniGame(id: string): MiniGame {
  const game = content.minigames.find((entry) => entry.id === id);
  if (!game) throw new Error(`fixture content is missing mini-game "${id}"`);
  return game;
}

/** The world with this id in the bundled tracks catalog — every spec-local copy of this same
 * lookup (`journey.spec.ts`, `assessment.spec.ts`, `generate-fixture.spec.ts`) collapses here. */
export function findWorld(id: string): World {
  const world = coreFindWorld(catalog, id);
  if (!world) throw new Error(`world "${id}" not found in tracks.json`);
  return world;
}

/** Every lesson of `catalog`'s main track, in Journey/session order — core's own `mainTrackLessons`. */
export const lessonsInJourneyOrder: (
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
) => readonly Lesson[] = mainTrackLessons;

/** The Journey's very first lesson for a brand-new profile on the bundled content — whichever one
 * that turns out to be. Every spec-local copy (`lesson.spec.ts`, `device-sharing.spec.ts`,
 * `smoke.spec.ts`) collapses here. */
export function firstJourneyLesson(): Lesson {
  const lesson = nextLesson(catalog, content.lessons, []);
  if (!lesson) throw new Error('bundled content/tracks: no first lesson found');
  return lesson;
}

/** The Journey's first lesson for a brand-new profile, and the lesson right after it in the same
 * world (siblings) — computed from the bundled content, whichever lesson/world that turns out to
 * be. Every spec-local copy (`journey.spec.ts`, `a11y.spec.ts`) collapses here. */
export function firstTwoLessons(): { readonly first: Lesson; readonly second: Lesson } {
  const first = firstJourneyLesson();
  const siblings = worldLessons(findWorld(first.world), content.lessons);
  const second = siblings[siblings.findIndex((lesson) => lesson.id === first.id) + 1];
  if (!second) throw new Error(`world "${first.world}" needs at least 2 lessons for this test`);
  return { first, second };
}

/** Escapes regex metacharacters so `text` can be embedded literally in a `RegExp` source. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A lesson's plain display label — its title when Owl-taught (`character-meta.ts`'s
 * `characterPieceOrNull`: no single piece for it, World 1's Owl lessons), else its character's
 * name — same as `JourneyScreen`'s `characterLabel`.
 */
export function lessonLabel(lesson: Lesson): string {
  return characterPieceOrNull(lesson.character) === null
    ? contentText(lesson.titleKey)
    : contentText(`characters:${lesson.character}.name`);
}

/**
 * Accessible name of a lesson's Journey node for `status` (matches `JourneyScreen`'s
 * `LessonNode`). For a piece lesson, the piece word is wildcarded: only app UI code
 * (`character-meta.ts`) maps character -> piece, which this e2e helper doesn't duplicate.
 */
export function journeyNodeName(lesson: Lesson, status: 'current' | 'locked'): RegExp {
  const statusWord = escapeRegExp(contentText(`journey:ui.status-${status}`));
  const label = escapeRegExp(lessonLabel(lesson));
  const namePart = characterPieceOrNull(lesson.character) === null ? label : `${label} the .+`;
  const pattern = interpolate(contentText('journey:ui.node-name'), {
    name: namePart,
    status: statusWord,
  });
  return new RegExp(`^${pattern}$`);
}

/**
 * A world's own tab button on the Journey map (`JourneyScreen`'s `WorldRow`: `"<order> <title>"`,
 * e.g. `"4 Check & Mate"`). The Journey defaults to whichever world `journey.nextStep` currently
 * points to (`defaultWorldId`), which is the world holding its own unwon world boss — not
 * necessarily the next world's first lesson — so a spec walking lesson to lesson across a world
 * boundary must click this explicitly instead of assuming the right map is already showing.
 */
export function worldTabName(worldCatalog: TracksCatalog, worldId: string): RegExp {
  const world = coreFindWorld(worldCatalog, worldId);
  if (world === undefined) {
    throw new Error(`worldTabName: world "${worldId}" not found in the tracks catalog`);
  }
  // Anchored on the order digit a kid never sees written out (`"1 Board"`, `"4 Check & Mate"`):
  // the title alone can also match an unrelated lesson node's own name (e.g. "Setting Up the
  // Board, locked" contains "Board" too).
  return new RegExp(`^${String(world.order)} ${escapeRegExp(contentText(world.titleKey))}`);
}

/** A world's own boss mini-game (`World.boss`, distinct from any lesson's own `boss`), if it has one. */
export function worldBossMiniGame(
  worldCatalog: TracksCatalog,
  worldId: string,
): MiniGame | undefined {
  const world = coreFindWorld(worldCatalog, worldId);
  return world?.boss === undefined ? undefined : findMiniGame(world.boss);
}

/** The Journey's "Finish X first!" message for the lesson right before a locked one. */
export function finishFirstMessage(previousLesson: Lesson): string {
  return interpolate(contentText('journey:ui.finish-first'), { name: lessonLabel(previousLesson) });
}

/** Home's Owl greeting for a freshly offered (not resumed, not all-done) lesson (`HomeScreen`). */
export function homeGreeting(lesson: Lesson): string {
  return characterPieceOrNull(lesson.character) === null
    ? interpolate(contentText('home.owl-next-topic'), { topic: contentText(lesson.titleKey) })
    : interpolate(contentText('home.owl-next'), {
        character: contentText(`characters:${lesson.character}.name`),
      });
}
