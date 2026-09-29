// Chess's `stimulus`/`demo` content: the concrete values the platform's compile pipeline plugs in
// for this app. Chess-bound.
import { join } from 'node:path';
import type { Stars } from '@learn/platform-core';
import { bot } from '../chess.ts';
import { doubleStepBefore } from '../core/chess/facts/special-moves.ts';
import { exerciseNote, isEasierOfferNote } from '../core/exercise/notes.ts';
import { hasPieceOf } from '../core/chess/facts/pieces.ts';
import type { CompiledContent, DemoHighlight } from '../core/chess/lesson.ts';
import type { ExerciseFeedback, ExerciseNoteCtx, Resolve } from '../core/exercise/notes.ts';
import type { Hint } from '../core/exercise/hint.ts';
import type { PieceType, Position, Square } from '../core/chess/types.ts';
import { chessCore } from '../core/chess-core.ts';
import { z } from 'zod';
import { loadBotBook } from './bot-book-load.ts';
import {
  checkExactlyOnePosition,
  compilePosition,
  positionFields,
  textRefSchema,
} from './kinds/common.ts';
import { EXERCISE_KIND_CONTENT } from './kinds/index.ts';
import { MINI_GAME_MODE_CONTENT } from './modes/index.ts';
import type {
  BadgesContent,
  ContentIds,
  DemoContent,
  StimulusContent,
  SubjectContent,
  Where,
} from '@learn/platform-content/subject';

interface StimulusYaml {
  readonly board?: string;
  readonly fen?: string;
  readonly toMove?: 'w' | 'b';
  readonly lastMove?: string;
}

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

export const chessStimulus: StimulusContent = {
  refine: checkExactlyOnePosition,

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

  check(def, at) {
    const { position } = def as { readonly position: Position };
    if (!hasPieceOf(position, position.toMove)) {
      at.issues.push(`${at.where}: side to move has no piece`);
    }
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

/** A lesson's demo: position, spoken text, board highlight: `legal-moves <square>` (most lessons) or `squares [<sq> …]`
 * (World 1: a row / diagonal / corner; zero squares highlights nothing). */
const chessDemoSchema = z
  .object({
    ...positionFields,
    /** Locale key for the demo's spoken text; defaults to `<lesson-id>.demo` when absent. */
    text: textRefSchema.optional(),
    highlight: z.string().regex(/^legal-moves [a-h][1-8]$|^squares(?: [a-h][1-8])*$/),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

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

interface ChessBadgeCondition {
  readonly type: string;
  readonly opponent?: string;
  readonly extra?: 'queen-kept';
  readonly event?: 'promotion' | 'castling';
  readonly mode?: 'local';
}

const BOT_LEVELS = [1, 2, 3, 4, 5];

/** Chess's badge condition fields and the `game-win` / `game-event` / `game-played` checks the engine's 7 generic types don't cover. */
export const chessBadges: BadgesContent = {
  fields: {
    extra: z.enum(['queen-kept']).optional(),
    event: z.enum(['promotion', 'castling']).optional(),
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

const BOT_LEVEL_NAMES = bot.BOT_LEVELS.map((level) => level.name);

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

/** The piece a lesson character stands for (`core.characters`' `topicKey`); `null` for a narrator-taught (Owl) character. */
function characterPieceOf(character: string): PieceType | null {
  const topicKey = chessCore.characters[character]?.topicKey;
  return topicKey?.startsWith('piece.') ? (topicKey.slice('piece.'.length) as PieceType) : null;
}

/** Every `EXERCISE_NOTES` entry's text as its own utterance via the app's `exerciseNote` dispatch. Each note shape's domain is
 * bounded and content-derived (characters, 1-3 stars, colour × piece, one `Hint` per wording); error notes also get the easier-offer sentence. */
function exerciseNoteTemplates(
  add: (text: string, source: string) => void,
  r: Resolve,
  all: CompiledContent,
): void {
  const characters = [...new Set(all.lessons.map((lesson) => lesson.character))];
  const placeholderCtx: ExerciseNoteCtx = { name: '', vars: { piece: 'r' }, stars: 3 };

  function addNote(feedback: ExerciseFeedback, ctx: ExerciseNoteCtx): void {
    if (feedback.kind === 'instruction') return;
    const plain = exerciseNote(r, feedback, ctx, false);
    if (plain === undefined) return;
    add(plain.text, 'exercise-note');
    if (isEasierOfferNote(feedback.kind)) {
      const withOffer = exerciseNote(r, feedback, ctx, true);
      if (withOffer) add(withOffer.text, 'exercise-note-easier-offer');
    }
  }

  // Every character's own display name and the piece it stands for (default rook).
  const ctxByCharacter = characters.map((character) => ({
    name: r(`characters:${character}.name`),
    piece: characterPieceOf(character) ?? 'r',
  }));

  // tap-first (never gets the easier offer: not an error kind) and illegal move (its own piece).
  for (const { name, piece } of ctxByCharacter) {
    addNote({ kind: 'tap-first' }, { name, vars: { piece }, stars: 3 });
    addNote({ kind: 'illegal' }, { name, vars: { piece }, stars: 3 });
  }

  // Plain error notes with no variables.
  addNote({ kind: 'select-wrong' }, placeholderCtx);
  addNote({ kind: 'select-missing' }, placeholderCtx);
  addNote({ kind: 'select-both' }, placeholderCtx);
  addNote({ kind: 'wrong-answer' }, placeholderCtx);
  addNote({ kind: 'wrong-move' }, placeholderCtx);
  addNote({ kind: 'wrong-placement' }, placeholderCtx);

  // Hint ladder (never gets the easier offer). Level-1 "squares" (piece hint) is the only shape
  // that varies by character; every other shape's text is character-independent.
  for (const { name, piece } of ctxByCharacter) {
    addNote(
      { kind: 'hint', hint: { kind: 'squares', level: 1, squares: [] } },
      { name, vars: { piece }, stars: 3 },
    );
  }
  const otherHints: readonly Hint[] = [
    { kind: 'squares', level: 2, squares: [] },
    { kind: 'squares', level: 3, squares: [] },
    { kind: 'yes-no', level: 1, squares: [], reveal: false },
    { kind: 'yes-no', level: 2, squares: [], reveal: false },
    { kind: 'yes-no', level: 3, squares: [], reveal: true },
    { kind: 'choice', level: 1, reveal: false },
    { kind: 'choice', level: 3, reveal: true },
    { kind: 'setup', level: 2, piece: { color: 'w', type: 'p' }, square: 'a1', placed: false },
    { kind: 'setup', level: 3, piece: { color: 'w', type: 'p' }, square: 'a1', placed: true },
  ];
  for (const hint of otherHints) {
    addNote({ kind: 'hint', hint }, placeholderCtx);
  }
  for (const color of ['w', 'b'] as const) {
    for (const type of VERSUS_PIECE_TYPES) {
      addNote(
        { kind: 'hint', hint: { kind: 'setup', level: 1, piece: { color, type }, placed: false } },
        placeholderCtx,
      );
    }
  }

  // Praise (solved), 1-3 stars; checkmate concatenates the "Checkmate!" line with the same praise.
  for (const stars of [1, 2, 3] as const satisfies readonly Stars[]) {
    addNote({ kind: 'solved' }, { ...placeholderCtx, stars });
    addNote({ kind: 'checkmate' }, { ...placeholderCtx, stars });
  }

  // Opponent's scripted reply (mate-in-n): colour × piece.
  for (const color of ['w', 'b'] as const) {
    for (const piece of VERSUS_PIECE_TYPES) {
      addNote(
        { kind: 'opponent-reply', reply: { from: 'a1', to: 'a2', san: 'a2', color, piece } },
        placeholderCtx,
      );
    }
  }
}

/** Play screen and versus boss texts: a locked lesson / mini-game (a character's first lesson is named by its piece, any other
 * by its title), the locked vs-friend line, the boss result lines and the Play / friend-setup owl lines. */
function playScreenTemplates(
  add: (text: string, source: string) => void,
  r: Resolve,
  all: CompiledContent,
): void {
  const named = new Set<string>();
  for (const lesson of all.lessons) {
    const topicKey = chessCore.characters[lesson.character]?.topicKey;
    const label =
      topicKey !== undefined && !named.has(lesson.character) ? r(topicKey) : r(lesson.titleKey);
    named.add(lesson.character);
    add(r('play.locked-condition', { label }), 'play');
  }
  for (const minigame of all.minigames) {
    add(r('play.locked-condition', { label: r(minigame.titleKey) }), 'play');
  }
  add(r('play.vs-friend-locked'), 'play');
  for (const key of ['won', 'draw', 'lost']) {
    add(r(`boss.versus.${key}`), 'versus-boss');
  }
  add(r('play.owl-line'), 'owl-line');
  add(r('friend-play.setup-owl-line'), 'owl-line');
}

/** Chess's Play / versus-boss / exercise-note voice templates: bot level names with the locked-level messages, the boss's bot
 * move / capture lines, every exercise-feedback note, the Play screen's own lines. */
export function chessVoiceTemplates(
  add: (text: string, source: string) => void,
  r: Resolve,
  all: CompiledContent,
): void {
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
  exerciseNoteTemplates(add, r, all);
  playScreenTemplates(add, r, all);
}

/** Chess's whole `SubjectContent`: what `compileAll` and every script / test that loads real content inject into the platform pipeline. */
export const chessContent: SubjectContent = {
  kinds: EXERCISE_KIND_CONTENT,
  modes: MINI_GAME_MODE_CONTENT,
  stimulus: chessStimulus,
  demo: chessDemo,
  badges: chessBadges,
  characters: chessCore.characters,
  defaultMode: 'static',
  extraOutputs: { 'bot-book.json': (root) => loadBotBook(join(root, 'bot-book.yaml')) },
  voiceTemplates: chessVoiceTemplates,
};
