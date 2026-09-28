/**
 * Chess-defaulted test wiring: an in-memory `ContentSource` and `makeDeps(overrides)`, which
 * plugs chess as the `AppDeps.subject` / `app` on top of the platform fakes.
 */
import {
  makeClock,
  makeIds,
  makeProfileRepo,
  makeProgressRepo,
  makeGameRecordRepo,
  makeParentLockRepo,
  makePasswordFileWriter,
  makeSettingsRepo,
} from '@learn/platform-core/testing';
import type { BadgeDef } from '@learn/platform-core/domain/badges';
import type { TracksCatalog } from '@learn/platform-core/domain/journey';
import type { Lesson, MiniGame } from '../chess.ts';
import { seededRandom } from '@learn/platform-core/domain/random';
import { createSubjectRuntime } from '@learn/platform-core/domain/runtime';
import { chessCore, CHESS_APP_CONFIG } from '../core/chess-core.ts';
import type { ContentSource } from '@learn/platform-core/app/ports';
import type { AppDeps } from '@learn/platform-core/app/use-cases';

/* -------------------------------------------------------------------- ContentSource -------- */

export interface ContentSourceSeed {
  readonly lessons?: readonly Lesson[];
  readonly minigames?: readonly MiniGame[];
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

/* -------------------------------------------------------------------- AppDeps -------------- */

/** Every required `AppDeps` port, wired to the in-memory fakes above. `subject`/`app` default to
 * chess (`createSubjectRuntime(chessCore)`, `CHESS_APP_CONFIG`) — the only subject today. */
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
    subject: createSubjectRuntime(chessCore),
    app: { ...CHESS_APP_CONFIG, version: '0.0.0-test' },
    ...overrides,
  };
}
