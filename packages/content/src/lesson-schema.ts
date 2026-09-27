import { z } from 'zod';
import {
  checkExactlyOnePosition,
  positionFields,
  squareSchema,
  textRefSchema,
} from './kinds/common.ts';
import { exerciseSchema, type ChoiceOptionYaml } from './kinds/index.ts';
import { keySchema } from './schema.ts';

export { exerciseSchema, squareSchema, textRefSchema };
export type { ChoiceOptionYaml };

/**
 * A lesson's demo: position, spoken text, and its board highlight — either `legal-moves <square>`
 * (most lessons: every square that piece can reach) or `squares [<sq> …]` (World 1: an explicit
 * list, e.g. a row/diagonal or a corner; zero squares highlights nothing).
 */
export const demoSchema = z
  .object({
    ...positionFields,
    text: textRefSchema,
    highlight: z.string().regex(/^legal-moves [a-h][1-8]$|^squares(?: [a-h][1-8])*$/),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

export type ExerciseYaml = z.infer<typeof exerciseSchema>;

/** One lesson file (`lessons/<world>/<lesson-id>.yaml`). */
export const lessonSchema = z
  .object({
    id: keySchema,
    world: keySchema,
    order: z.number().int().positive(),
    concept: keySchema,
    character: keySchema,
    title: textRefSchema,
    story: textRefSchema,
    demo: demoSchema,
    guided: z.array(exerciseSchema),
    exercises: z.array(exerciseSchema).min(1),
    variants: z.array(exerciseSchema).optional(),
    boss: keySchema.optional(),
  })
  .strict();

export type LessonYaml = z.infer<typeof lessonSchema>;

const miniGameCommonFields = {
  id: keySchema,
  concept: keySchema,
  unlockAfter: keySchema,
  title: textRefSchema,
  goal: textRefSchema,
};

/** FEN letter of a non-king piece type, for a `capture` win condition (`p`, `n`, `b`, `r`, `q`). */
const NON_KING_PIECE_PATTERN = /^[pnbrq]$/;

/**
 * One side's win condition, as authored (`docs/domain-model.md` §1.4): the parameterless kinds are
 * a bare string, the parameterised ones a single-key object. Compiled to a `WinCondition` by
 * `lesson-load.ts`.
 */
const winConditionSchema = z.union([
  z.literal('checkmate'),
  z.literal('promote'),
  z.literal('capture-all'),
  z.object({ capture: z.string().regex(NON_KING_PIECE_PATTERN) }).strict(),
  z.object({ reach: z.array(squareSchema).min(1) }).strict(),
  z.object({ survive: z.number().int().positive() }).strict(),
]);

/**
 * A `versus` mini-game's rules (Pawn Wars, …): variant game rules plus which win conditions belong
 * to the kid vs. the opponent — `lesson-load.ts` maps `kid`/`opponent` to `w`/`b` by `kidColor`.
 * `checkRules` is not authored: it is derived from `kings` (only ever true when both are present).
 */
const versusRulesSchema = z
  .object({
    kings: z.boolean(),
    noMoves: z.enum(['lose', 'draw']),
    win: z
      .object({
        kid: z.array(winConditionSchema).min(1),
        opponent: z.array(winConditionSchema).min(1),
      })
      .strict(),
  })
  .strict();

/**
 * A `versus` mini-game (M2.6): variant rules played against the computer opponent, not a static or
 * scripted one. `kidColor` defaults to `w`; `par` is the kid-move threshold for 3 stars.
 */
const versusMiniGameSchema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('versus'),
    ...positionFields,
    rules: versusRulesSchema,
    opponent: z.object({ bot: z.number().int().min(1).max(5) }).strict(),
    kidColor: z.enum(['w', 'b']).optional(),
    par: z.number().int().positive().optional(),
    moveLimit: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

/**
 * A `static` mini-game (default `mode`, back-compat with every file authored before M2.4): `type`
 * is the win condition (`capture-all`, the default, or `collect-stars`); `goal` is the spoken-text
 * key for the goal line shown in-game — two different things that happen to share the English word
 * "goal".
 */
const staticMiniGameSchema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('static').optional(),
    type: z.enum(['capture-all', 'collect-stars']).optional(),
    ...positionFields,
    par: z.number().int().positive(),
    moveLimit: z.number().int().positive(),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

/**
 * A `series` mini-game (Square Hunt, Setup Race, M3's Safe or Not? / …): a fixed sequence of
 * `rounds`, each an exercise of any type (validated the same way as a lesson's own exercises),
 * scored on total mistakes (errors + hint levels) across every round.
 */
const seriesMiniGameSchema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('series'),
    rounds: z.array(exerciseSchema).min(1),
    errors3: z.number().int().nonnegative(),
    errors2: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.errors2 < value.errors3) {
      ctx.addIssue({
        code: 'custom',
        path: ['errors2'],
        message: '"errors2" must be >= "errors3"',
      });
    }
  });

/** One mini-game file (`minigames/<id>.yaml`): `static`, `series`, or `versus` (`mode`, default `static`). */
export const miniGameSchema = z.union([
  staticMiniGameSchema,
  seriesMiniGameSchema,
  versusMiniGameSchema,
]);

export type MiniGameYaml = z.infer<typeof miniGameSchema>;
export type StaticMiniGameYaml = z.infer<typeof staticMiniGameSchema>;
export type SeriesMiniGameYaml = z.infer<typeof seriesMiniGameSchema>;
export type VersusMiniGameYaml = z.infer<typeof versusMiniGameSchema>;
export type WinConditionYaml = z.infer<typeof winConditionSchema>;
