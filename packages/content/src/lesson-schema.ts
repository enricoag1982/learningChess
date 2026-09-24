import { z } from 'zod';
import { keySchema } from './schema.ts';

/** Algebraic square, e.g. `e4`. */
const SQUARE_PATTERN = /^[a-h][1-8]$/;
export const squareSchema = z.string().regex(SQUARE_PATTERN);

/**
 * Locale key reference: one or more kebab-case segments joined by dots, e.g. `rook-01` or
 * `rook.story`. Compiles to `lessons:<value>` (or `characters:<value>` for character names).
 */
const TEXT_REF_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;
export const textRefSchema = z.string().regex(TEXT_REF_PATTERN);

/** Fields shared by anything authored as a board diagram or FEN (see `parseDiagram` / `parseFen`). */
const positionFields = {
  board: z.string().optional(),
  fen: z.string().optional(),
  toMove: z.enum(['w', 'b']).optional(),
};

/** Cross-field check shared by every schema with `positionFields`: exactly one of `board` / `fen`. */
function checkExactlyOnePosition(
  value: { readonly board?: string; readonly fen?: string },
  ctx: z.RefinementCtx,
): void {
  if ((value.board !== undefined) === (value.fen !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'exactly one of "board" or "fen" is required' });
  }
}

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

const exerciseCommonFields = {
  id: keySchema,
  text: textRefSchema,
  easier: keySchema.optional(),
  /**
   * The opponent's last move, `<from><to>` (e.g. `d7d5`), display only (M4.1): the loader checks a
   * piece sits on `to`, and — when the position has an en passant square — that this is exactly the
   * double step that produced it. See `ExerciseBase.lastMove` (`@chess-kids/core`).
   */
  lastMove: z
    .string()
    .regex(/^[a-h][1-8][a-h][1-8]$/)
    .optional(),
  ...positionFields,
};

const collectStarsSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('collect-stars'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

const captureSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('capture'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

const selectSquaresSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('select-squares'),
    answer: z.array(squareSchema).optional(),
    derive: z.enum(['legal-moves', 'attacked-by', 'check-escapes']).optional(),
    from: squareSchema.optional(),
  })
  .strict();

/**
 * A `yes-no` exercise's optional load-time-only check: the loader computes the named rule fact on
 * the exercise's own position and fails the build if it contradicts `answer`, so a "safe?" /
 * "in check?" answer can never be authored wrong. Never compiled into the runtime `ExerciseDef`.
 * M4.1 adds `can-castle kingside|queenside`, `can-en-passant` and `insufficient-material`.
 */
const yesNoVerifySchema = z
  .string()
  .regex(
    /^(?:hanging|attacked|defended) [a-h][1-8]$|^(?:in-check|checkmate|stalemate|insufficient-material)$|^can-castle (?:kingside|queenside)$|^can-en-passant$/,
  );

const yesNoSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('yes-no'),
    answer: z.enum(['yes', 'no']),
    focus: squareSchema.optional(),
    verify: yesNoVerifySchema.optional(),
  })
  .strict();

/** FEN letter of a piece, either colour (`K`, `q`, …). */
const FEN_PIECE_PATTERN = /^[KQRBNPkqrbnp]$/;

const choiceOptionSchema = z
  .object({
    id: keySchema,
    text: textRefSchema.optional(),
    piece: z.string().regex(FEN_PIECE_PATTERN).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.text === undefined && value.piece === undefined) {
      ctx.addIssue({ code: 'custom', message: 'option needs "text" or "piece"' });
    }
  });

const choiceSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('choice'),
    options: z.array(choiceOptionSchema).min(2),
    answer: z.string(),
    /** Hides the board (default: shown). Named apart from `board`, the position diagram field. */
    showBoard: z.boolean().optional(),
    /**
     * Load-time-only check (M3.1 `higher-value`; M3.2b `worth <n>` / `trade <SAN>`): `higher-value`
     * requires every option to be a piece and `answer` to be the (unique) higher-value one;
     * `worth <n>` requires every option to be a piece and `answer` to be the (unique) option worth
     * exactly `<n>`; `trade <SAN>` requires options ids `good`/`equal`/`bad` and `answer` to match
     * the loader's classification of the kid capture `<SAN>` in the position; `draw-kind` (M4.1)
     * requires options ids `stalemate`/`insufficient-material`/`not-a-draw` and `answer` to match
     * the loader's classification of the position. Never compiled into the runtime `ExerciseDef`.
     */
    verify: z
      .string()
      .regex(/^higher-value$|^worth [0-9]+$|^trade \S+$|^draw-kind$/)
      .optional(),
  })
  .strict();

/**
 * A `best-move` exercise's optional load-time-only check (M3.2b, M3.3): the loader computes the
 * exact set of legal kid moves satisfying the named rule and fails the build unless `solutions`
 * equals that set (order-insensitive, by SAN) — `attack <sq>` (the moved piece newly attacks the
 * enemy piece on `<sq>`), `save <sq>` (the kid piece on `<sq>`, not safe now, is safe after the
 * move, on its new square if it moved), `take-free` (captures of an undefended enemy piece),
 * `good-trade` (captures worth more than the capturer, or of an undefended piece), `check` (the
 * move gives check), `escape-king` / `escape-block` / `escape-capture` (the kid's king must be in
 * check: a non-capturing king move / an interposition / a capture of the checking piece, a king
 * capture included only under `escape-capture`); `castle` (M4.1: exactly the legal `O-O`/`O-O-O`
 * moves), `en-passant` (M4.1: exactly the legal en passant captures). Never compiled into the
 * runtime `BestMoveDef`.
 */
const bestMoveVerifySchema = z
  .string()
  .regex(
    /^attack [a-h][1-8]$|^save [a-h][1-8]$|^take-free$|^good-trade$|^check$|^escape-king$|^escape-block$|^escape-capture$|^castle$|^en-passant$/,
  );

const bestMoveSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('best-move'),
    solutions: z.array(z.string()).min(1),
    verify: bestMoveVerifySchema.optional(),
  })
  .strict();

const mateInNSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('mate-in-n'),
    n: z.number().int().positive(),
    line: z.array(z.string()).min(1),
    /**
     * M3.3 "don't stalemate" exercises: the loader requires at least one legal kid move (other than
     * the scripted mating line) that would stalemate the opponent instead — a trap the exercise is
     * meant to teach avoiding. Load-time only, never compiled into the runtime `MateInNDef`.
     */
    trap: z.literal('stalemate').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = 2 * value.n - 1;
    if (value.line.length !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['line'],
        message: `"line" must have exactly 2*n-1 = ${String(expected)} moves for n=${String(value.n)}`,
      });
    }
  });

/** A setup exercise's goal position: same shape as `positionFields`, minus `toMove` (unused). */
const targetSchema = z
  .object({ board: z.string().optional(), fen: z.string().optional() })
  .strict()
  .superRefine(checkExactlyOnePosition);

const setupSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('setup'),
    target: targetSchema,
  })
  .strict();

/** One exercise (`guided` or `exercises` entry), discriminated by `type`. */
export const exerciseSchema = z
  .discriminatedUnion('type', [
    collectStarsSchema,
    captureSchema,
    selectSquaresSchema,
    yesNoSchema,
    choiceSchema,
    bestMoveSchema,
    setupSchema,
    mateInNSchema,
  ])
  .superRefine((value, ctx) => {
    checkExactlyOnePosition(value, ctx);
    if (value.type === 'select-squares') {
      const hasAnswer = value.answer !== undefined;
      const hasDerive = value.derive !== undefined || value.from !== undefined;
      if (hasAnswer === hasDerive) {
        ctx.addIssue({
          code: 'custom',
          message: 'exactly one of "answer" or "derive" + "from" is required',
        });
        return;
      }
      if (hasAnswer && value.answer?.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['answer'], message: '"answer" must not be empty' });
      }
      if (hasDerive) {
        const needsFrom = value.derive === 'legal-moves' || value.derive === 'attacked-by';
        if (value.derive === undefined) {
          ctx.addIssue({ code: 'custom', path: ['derive'], message: '"from" requires "derive"' });
        } else if (needsFrom && value.from === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['from'],
            message: `"derive: ${value.derive}" requires "from"`,
          });
        } else if (!needsFrom && value.from !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['from'],
            message: `"derive: ${value.derive}" must not set "from"`,
          });
        }
      }
    }
    if (value.type === 'choice') {
      const ids = value.options.map((option) => option.id);
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message: `duplicate option id "${id}"`,
          });
        }
        seen.add(id);
      }
      if (!ids.includes(value.answer)) {
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: '"answer" must reference one of "options"',
        });
      }
    }
  });

export type ExerciseYaml = z.infer<typeof exerciseSchema>;
export type ChoiceOptionYaml = z.infer<typeof choiceOptionSchema>;

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
