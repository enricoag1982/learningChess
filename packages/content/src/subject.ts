// Platform content abstraction: the subject-free shapes the YAML → JSON pipeline compiles through.
// Pure TS; zod type-only — a subject supplies its own concrete schema/compile logic on top.
import type { z } from 'zod';

/** Where in the source YAML an issue was found (`<relPath>: <fieldPath>`), and the shared issues
 * list every compile/check step pushes onto. */
export interface Where {
  readonly where: string;
  readonly issues: string[];
}

/** A subject's own stimulus (chess: board position + last move), compiled from an exercise's raw
 * YAML into the fields prepended (`head`) and appended (`tail`) to every exercise definition. */
export interface StimulusContent {
  compile(raw: object, at: Where): { readonly head: object; readonly tail: object } | null;
}

/** A subject's own lesson demo: its schema, how to compile it, and an optional semantic check
 * (chess: a kid piece must sit on the board). */
export interface DemoContent {
  readonly schema: z.ZodType;
  compile(raw: unknown, textKey: string, at: Where): { readonly textKey: string } | null;
  check?(demo: object, at: Where): void;
}
