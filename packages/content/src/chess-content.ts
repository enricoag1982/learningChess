// Chess's `stimulus`/`demo` content: the concrete values the platform's compile pipeline plugs in
// for this app. Chess-bound.
import {
  doubleStepBefore,
  hasPieceOf,
  type DemoHighlight,
  type Position,
  type Square,
} from '@chess-kids/core/chess';
import { z } from 'zod';
import {
  checkExactlyOnePosition,
  compilePosition,
  positionFields,
  textRefSchema,
} from './kinds/common.ts';
import type { DemoContent, StimulusContent, Where } from './subject.ts';

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
