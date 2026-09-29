// Platform content abstraction: the subject-free shapes the YAML → JSON pipeline compiles through.
// Pure TS; zod type-only — a subject supplies its own concrete schema/compile logic on top.
import type { CompiledContent } from '@learn/platform-core';
import type { z } from 'zod';
import type { AnyExerciseKindContent } from './kinds/kind-content.ts';
import type { AnyMiniGameModeContent } from './modes/mode-content.ts';

export type Resolve = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

/** Fields every exercise's raw YAML shares (`kinds/common.ts`'s `exerciseCommonFields`), so the generic pipeline needs no
 * subject kind shape. */
export interface ExerciseYamlBase {
  readonly id: string;
  readonly type: string;
  readonly text?: string;
  readonly easier?: string;
}

/** Where in the source YAML an issue was found (`<relPath>: <fieldPath>`), and the shared issues
 * list every compile/check step pushes onto. */
export interface Where {
  readonly where: string;
  readonly issues: string[];
}

/** A subject's stimulus (chess: board position + last move): compiled into the `head` / `tail` fields of every exercise
 * def, plus an optional semantic check (chess: a kid piece must sit on the board). */
export interface StimulusContent {
  /** Cross-field check of a parsed exercise's own stimulus fields (chess: one of `board` / `fen`). */
  refine?(raw: object, ctx: z.RefinementCtx): void;
  compile(raw: object, at: Where): { readonly head: object; readonly tail: object } | null;
  check?(def: object, at: Where): void;
}

/** The demo field the generic loader reads: the spoken text's key (default `<lesson-id>.demo`). */
export interface DemoYamlBase {
  readonly text?: string;
}

/** A subject's lesson demo: schema, compile, optional semantic check (chess: a kid piece must sit on the board). */
export interface DemoContent {
  readonly schema: z.ZodType<DemoYamlBase>;
  compile(raw: unknown, textKey: string, at: Where): { readonly textKey: string } | null;
  check?(demo: object, at: Where): void;
}

export type ZodShape = Readonly<Record<string, z.ZodType>>;

/** Id sets a subject's own badge validation cross-references against (chess: mini-game ids). */
export interface ContentIds {
  readonly minigameIds: ReadonlySet<string>;
}

/** A subject's badge condition fields (chess: `extra`/`event`/`mode`) and validation for the types the engine's 7 generic
 * ones don't cover (the content counterpart of `core.rewards`). */
export interface BadgesContent {
  readonly fields: ZodShape;
  validate(condition: object, at: Where, ids: ContentIds): void;
}

/** One subject's whole content behaviour: exercise-kind and mini-game-mode registries, stimulus, demo, badges, characters
 * (one source with `core.characters`) and voice-template texts. */
export interface SubjectContent {
  readonly kinds: Readonly<Record<string, AnyExerciseKindContent>>;
  readonly modes: Readonly<Record<string, AnyMiniGameModeContent>>;
  readonly stimulus: StimulusContent;
  readonly demo: DemoContent;
  readonly badges: BadgesContent;
  readonly characters: Readonly<Record<string, { readonly topicKey: string }>>;
  /** The mode a mini-game file without `mode` uses (chess: `static`); absent = every file must name its mode. */
  readonly defaultMode?: string;
  /** Extra `dist/` files by name, each built from the content root (chess: `bot-book.json`). */
  readonly extraOutputs?: Readonly<Record<string, (root: string) => unknown>>;
  /** `all`: the already-compiled content, for domains only it bounds (chess: which characters need
   * a hint/note text). */
  voiceTemplates(
    add: (text: string, source: string) => void,
    r: Resolve,
    all: CompiledContent,
  ): void;
}
