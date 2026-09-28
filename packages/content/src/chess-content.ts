// Chess's `stimulus`/`demo` content: the concrete values the platform's compile pipeline plugs in
// for this app. Chess-bound.
import {
  bot,
  doubleStepBefore,
  hasPieceOf,
  type DemoHighlight,
  type Position,
  type Resolve,
  type Square,
} from '@chess-kids/core/chess';
import { z } from 'zod';
import {
  checkExactlyOnePosition,
  compilePosition,
  positionFields,
  textRefSchema,
} from './kinds/common.ts';
import type { BadgesContent, ContentIds, DemoContent, StimulusContent, Where } from './subject.ts';

interface StimulusYaml {
  readonly board?: string;
  readonly fen?: string;
  readonly toMove?: 'w' | 'b';
  readonly lastMove?: string;
}

/** Parses `lastMove`'s `<from><to>` shape (the schema's regex already restricted it). */
function parseLastMove(raw: string): { readonly from: Square; readonly to: Square } {
  return { from: raw.slice(0, 2) as Square, to: raw.slice(2, 4) as Square };
}

/** `lastMove`, display only: checks it against `position` — a piece must sit on `to`, and, with an
 * en passant square, `lastMove` must be exactly the double step that produced it. */
function checkLastMove(
  position: Position,
  lastMove: { readonly from: Square; readonly to: Square },
  at: Where,
): void {
  if (position.pieces[lastMove.to] === undefined) {
    at.issues.push(
      `${at.where}: lastMove "${lastMove.from}${lastMove.to}": no piece on ${lastMove.to}`,
    );
  }
  const ep = position.enPassant;
  if (ep === null) {
    return;
  }
  const expected = doubleStepBefore(ep);
  if (lastMove.from !== expected.from || lastMove.to !== expected.to) {
    at.issues.push(
      `${at.where}: lastMove "${lastMove.from}${lastMove.to}" is not the double step matching en ` +
        `passant square ${ep} (expected "${expected.from}${expected.to}")`,
    );
  }
}

/** Chess's stimulus: a board position (the "head") plus an optional last move (the "tail"). */
export const chessStimulus: StimulusContent = {
  compile(raw, at) {
    const r = raw as StimulusYaml;
    const position = compilePosition(r, { where: `${at.where}.board`, issues: at.issues });
    if (position === null) {
      return null;
    }
    if (r.lastMove === undefined) {
      return { head: { position }, tail: {} };
    }
    const lastMove = parseLastMove(r.lastMove);
    checkLastMove(position, lastMove, at);
    return { head: { position }, tail: { lastMove } };
  },
};

/** A lesson demo's board highlight: `legal-moves <square>` (every square that piece can reach) or
 * `squares [<sq> …]` (an explicit list; the schema already restricted the shape). */
function compileHighlight(raw: string): DemoHighlight {
  if (raw.startsWith('legal-moves ')) {
    return { legalMovesFrom: raw.slice('legal-moves '.length) as Square };
  }
  const rest = raw.slice('squares'.length).trim();
  return { squares: rest === '' ? [] : (rest.split(' ') as Square[]) };
}

/**
 * A lesson's demo: position, spoken text, and its board highlight — either `legal-moves <square>`
 * (most lessons: every square that piece can reach) or `squares [<sq> …]` (World 1: an explicit
 * list, e.g. a row/diagonal or a corner; zero squares highlights nothing). Exported by its own
 * concrete type too, so `lesson-schema.ts` keeps `LessonYaml`'s fields precisely inferred.
 */
export const chessDemoSchema = z
  .object({
    ...positionFields,
    /** Locale key for the demo's spoken text; defaults to `<lesson-id>.demo` when absent. */
    text: textRefSchema.optional(),
    highlight: z.string().regex(/^legal-moves [a-h][1-8]$|^squares(?: [a-h][1-8])*$/),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

/** Chess's lesson demo: position + spoken text + board highlight. */
export const chessDemo: DemoContent = {
  schema: chessDemoSchema,

  compile(raw, textKey, at) {
    const r = raw as StimulusYaml & { readonly highlight: string };
    const position = compilePosition(r, { where: `${at.where}.board`, issues: at.issues });
    if (position === null) {
      return null;
    }
    return { position, textKey, highlight: compileHighlight(r.highlight) };
  },

  check(demo, at) {
    const { position } = demo as { readonly position: Position };
    if (!hasPieceOf(position, position.toMove)) {
      at.issues.push(`${at.where}: side to move has no piece`);
    }
  },
};

/** A badge condition's chess-only fields (shape-only; `chessBadges.validate` checks the rest). */
interface ChessBadgeCondition {
  readonly type: string;
  readonly opponent?: string;
  readonly extra?: 'queen-kept';
  readonly event?: 'promotion' | 'castling';
  readonly mode?: 'local';
}

const BOT_LEVELS = [1, 2, 3, 4, 5];

/** Chess's own badge condition fields and the `game-win`/`game-event`/`game-played` checks the
 * engine's 7 generic condition types don't cover. */
export const chessBadges: BadgesContent = {
  fields: {
    /** `game-win`: `'queen-kept'` counts wins where the kid's queen was never captured. */
    extra: z.enum(['queen-kept']).optional(),
    /** `game-event`: which `GameRecord.moves` pattern to count. */
    event: z.enum(['promotion', 'castling']).optional(),
    /** `game-played`: `'local'` (vs a friend). */
    mode: z.enum(['local']).optional(),
  },

  validate(condition, at, ids: ContentIds) {
    const c = condition as ChessBadgeCondition;
    switch (c.type) {
      case 'game-win': {
        if (c.extra === 'queen-kept') {
          if (c.opponent !== undefined) {
            at.issues.push(`${at.where}: extra "queen-kept" does not take "opponent"`);
          }
          return;
        }
        if (c.opponent === undefined) {
          at.issues.push(
            `${at.where}: type "game-win" requires "opponent" (or extra "queen-kept")`,
          );
          return;
        }
        if (c.opponent === 'any') return;
        if (c.opponent.startsWith('computer:')) {
          const level = Number(c.opponent.slice('computer:'.length));
          if (!BOT_LEVELS.includes(level)) {
            at.issues.push(
              `${at.where}: opponent "computer:<n>" must be a level 1-5, got "${c.opponent}"`,
            );
          }
          return;
        }
        if (!ids.minigameIds.has(c.opponent)) {
          at.issues.push(`${at.where}: opponent references unknown mini-game "${c.opponent}"`);
        }
        return;
      }
      case 'game-event':
        if (c.event === undefined) {
          at.issues.push(`${at.where}: type "game-event" requires "event"`);
        }
        return;
      case 'game-played':
        if (c.mode === undefined) {
          at.issues.push(`${at.where}: type "game-played" requires "mode"`);
        }
        return;
    }
  },
};

/** Mouse → Bear ladder, from the one source (`domain/bot/levels.ts`'s `BOT_LEVELS`). */
const BOT_LEVEL_NAMES = bot.BOT_LEVELS.map((level) => level.name);

/** Every board piece type, for the versus boss's move/capture lines. */
const VERSUS_PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'] as const;

/** `PlayScreen.tsx`'s `levelConditionText`: either "full game locked" or "beat <name> 3 times". */
function levelConditionTexts(r: Resolve): readonly string[] {
  return [
    r('play.full-game-locked'),
    ...BOT_LEVEL_NAMES.map((name) =>
      r('play.level-condition-beat', { name: r(`boss.versus.bot-name.${name}`), times: 3 }),
    ),
  ];
}

/** Chess's own Play / versus-boss voice templates: every bot level's name, combined with the Play
 * screen's locked-level messages and the versus boss's own bot move/capture lines. */
export function chessVoiceTemplates(add: (text: string, source: string) => void, r: Resolve): void {
  const conditionTexts = levelConditionTexts(r);
  for (const name of BOT_LEVEL_NAMES) {
    const botName = r(`boss.versus.bot-name.${name}`);
    for (const condition of conditionTexts) {
      add(r('play.level-name-locked', { name: botName, condition }), 'play');
    }
    add(r('play.level-up-suggestion', { name: botName }), 'play');
  }
  for (const name of BOT_LEVEL_NAMES) {
    const botName = r(`boss.versus.bot-name.${name}`);
    for (const piece of VERSUS_PIECE_TYPES) {
      const pieceName = r(`board.piece.${piece}`);
      add(r('boss.versus.bot-captured', { name: botName, piece: pieceName }), 'versus-boss');
      add(r('boss.versus.bot-moved', { name: botName, piece: pieceName }), 'versus-boss');
    }
  }
  for (const piece of VERSUS_PIECE_TYPES) {
    add(r('boss.versus.kid-captured', { piece: r(`board.piece.${piece}`) }), 'versus-boss');
  }
}
