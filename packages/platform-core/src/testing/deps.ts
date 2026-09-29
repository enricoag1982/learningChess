/**
 * Test wiring for `AppDeps`: an in-memory `ContentSource` and `makeDeps(overrides)`, which puts
 * `testSubject` (and `TEST_APP_CONFIG`) on top of the port fakes. A real subject's own testing
 * kit wraps it with its own `subject` / `app`.
 */
import type { BadgeDef } from '../domain/badges.ts';
import type { TracksCatalog } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import { seededRandom } from '../domain/random.ts';
import { createSubjectRuntime } from '../domain/runtime.ts';
import type { MiniGameBase } from '../domain/subject.ts';
import type { ContentSource } from '../app/ports.ts';
import type { AppDeps } from '../app/use-cases.ts';
import {
  makeClock,
  makeGameRecordRepo,
  makeIds,
  makeParentLockRepo,
  makePasswordFileWriter,
  makeProfileRepo,
  makeProgressRepo,
  makeSettingsRepo,
} from './fakes.ts';
import { TEST_APP_CONFIG, testSubject } from './test-subject.ts';

export interface ContentSourceSeed {
  readonly lessons?: readonly Lesson[];
  readonly minigames?: readonly MiniGameBase[];
  readonly catalog?: TracksCatalog;
  readonly badges?: readonly BadgeDef[];
}

/** In-memory `ContentSource`. `catalog`/`badges` are present on the result only when seeded —
 * both are optional on the real port, and a fixture that never wires one up should keep whatever
 * "not implemented" behaviour the production code has for it. */
export function makeContentSource(seed: ContentSourceSeed = {}): ContentSource {
  const { lessons = [], minigames = [], catalog, badges } = seed;
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const minigamesById = new Map(minigames.map((game) => [game.id, game]));
  return {
    lessons: () => lessons,
    lesson: (id) => lessonsById.get(id),
    minigames: () => minigames,
    minigame: (id) => minigamesById.get(id),
    ...(catalog === undefined ? {} : { catalog: () => catalog }),
    ...(badges === undefined ? {} : { badges: () => badges }),
  };
}

/** Content-less `ContentSource`, for use cases that never touch it. */
export const stubContent: ContentSource = makeContentSource();

/** Every required `AppDeps` port, wired to the in-memory fakes. `subject` / `app` default to
 * `testSubject` / `TEST_APP_CONFIG`. */
export function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    gameRecords: makeGameRecordRepo(),
    clock: makeClock(),
    ids: makeIds(),
    content: stubContent,
    parentLock: makeParentLockRepo(),
    passwordFile: makePasswordFileWriter(),
    settings: makeSettingsRepo(),
    random: seededRandom(1),
    subject: createSubjectRuntime(testSubject),
    app: TEST_APP_CONFIG,
    ...overrides,
  };
}
