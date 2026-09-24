import type { ChessRules, Move, SearchBoard } from '../chess/rules.ts';
import type { Color, PieceType, Position, Square } from '../chess/types.ts';
import { evaluateTerminal } from '../game/index.ts';
import type { GameRulesDef, GameState } from '../game/index.ts';
import type { Random } from '../random.ts';
import {
  boardView,
  evaluateBoard,
  needsPiecesForTerminal,
  PIECE_VALUE,
  staticEval,
  terminalScore,
} from './evaluate.ts';
import type { BotLevel } from './levels.ts';

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function captureValue(move: Move): number {
  return move.captured === undefined ? 0 : PIECE_VALUE[move.captured];
}

/**
 * Captures first, largest capture first; a stable sort keeps the rest in generation order. Skips
 * the sort on a node with no captures at all (most of them, deep in the tree) — this runs at every
 * node, so that is worth the one extra scan.
 */
function orderMoves(moves: readonly Move[]): Move[] {
  if (!moves.some((move) => move.captured !== undefined)) {
    return [...moves];
  }
  return [...moves].sort((a, b) => captureValue(b) - captureValue(a));
}

function pickUniform(moves: readonly Move[], random: Random): Move {
  const index = Math.min(moves.length - 1, Math.floor(random.next() * moves.length));
  const move = moves[index];
  if (move === undefined) {
    throw new Error('pickUniform: empty move list');
  }
  return move;
}

/**
 * A move that immediately wins the game for its own colour (checkmate or a declared variant win).
 * Runs on every move for every level but Mouse, so this goes through the fast `SearchBoard`
 * (`ChessRules.play`/`legalMoves`/`status` each rebuild a chess.js instance and compute full SAN —
 * fine once per real move, far too slow to redo here for every candidate). `board.play` accepts a
 * `ChessRules`-sourced move like these `legalMoves` fine: it falls back to matching by square when
 * a move did not come from its own `moves()`.
 */
function findImmediateWin(
  def: GameRulesDef,
  board: SearchBoard,
  legalMoves: readonly Move[],
): Move | null {
  const needsPieces = needsPiecesForTerminal(def);
  for (const move of legalMoves) {
    board.play(move);
    const view = boardView(board, board.moves(), needsPieces);
    const result = evaluateTerminal(def, view, move);
    board.undo();
    if (result.kind === 'win' && result.winner === move.color) {
      return move;
    }
  }
  return null;
}

function squaresOf(pieces: Position['pieces'], color: Color, type: PieceType): Square[] {
  return Object.entries(pieces)
    .filter(([, piece]) => piece.color === color && piece.type === type)
    .map(([square]) => square as Square);
}

/**
 * Drops queen moves from the candidate list during the level's opening "queen stays home" window,
 * unless the queen is currently attacked or moving it is the only legal option.
 */
function applyQueenHome(
  moves: readonly Move[],
  state: GameState,
  level: BotLevel,
  rules: ChessRules,
): Move[] {
  if (level.queenHomeMoves <= 0) {
    return [...moves];
  }
  const botColor = state.position.toMove;
  const ownMovesSoFar = state.history.filter((move) => move.color === botColor).length;
  if (ownMovesSoFar >= level.queenHomeMoves) {
    return [...moves];
  }
  const queenSquares = squaresOf(state.position.pieces, botColor, 'q');
  const attacked = queenSquares.some(
    (square) => rules.attackers(state.position, square, other(botColor)).length > 0,
  );
  if (attacked) {
    return [...moves];
  }
  const withoutQueen = moves.filter((move) => move.piece !== 'q');
  return withoutQueen.length > 0 ? withoutQueen : [...moves];
}

/**
 * Alpha-beta negamax. Checks `evaluateTerminal` at every node (a variant can win mid-tree, e.g.
 * capturing the flagged piece), not only at the leaves; `needsPieces` skips building the (more
 * costly) piece map for that check when the def has no such condition, which plain chess never
 * does — only checkmate, decided from the legal-move count and check flag alone.
 */
function negamax(
  board: SearchBoard,
  def: GameRulesDef,
  needsPieces: boolean,
  depth: number,
  alpha: number,
  beta: number,
  plyFromRoot: number,
  lastMove: Move | undefined,
): number {
  const moves = board.moves();
  const view = boardView(board, moves, needsPieces);
  const terminal = terminalScore(def, view, plyFromRoot, lastMove);
  if (terminal !== null) {
    return terminal;
  }
  if (depth === 0) {
    return staticEval(needsPieces ? view : boardView(board, moves, true), def);
  }

  let best = -Infinity;
  let localAlpha = alpha;
  for (const move of orderMoves(moves)) {
    board.play(move);
    const score = -negamax(
      board,
      def,
      needsPieces,
      depth - 1,
      -beta,
      -localAlpha,
      plyFromRoot + 1,
      move,
    );
    board.undo();
    if (score > best) {
      best = score;
    }
    if (best > localAlpha) {
      localAlpha = best;
    }
    if (localAlpha >= beta) {
      break;
    }
  }
  return best;
}

interface ScoredMove {
  readonly move: Move;
  readonly score: number;
}

function chooseShallow(
  candidates: readonly Move[],
  board: SearchBoard,
  def: GameRulesDef,
  random: Random,
): Move {
  let best = -Infinity;
  const scored: ScoredMove[] = [];
  for (const move of candidates) {
    board.play(move);
    const score = -evaluateBoard(board, def, 1, move);
    board.undo();
    scored.push({ move, score });
    if (score > best) {
      best = score;
    }
  }
  const top = scored.filter((entry) => entry.score === best).map((entry) => entry.move);
  return pickUniform(top, random);
}

/** Opponent's best immediate capture value after this move, as a simple "does this hang a piece?" check. */
function hangRisk(board: SearchBoard): number {
  let risk = 0;
  for (const reply of board.moves()) {
    if (reply.captured !== undefined) {
      risk = Math.max(risk, PIECE_VALUE[reply.captured]);
    }
  }
  return risk;
}

/** Bear's "capture check": among the near-best moves, prefer the ones that leave the least hanging. */
function preferSafe(pool: readonly ScoredMove[], board: SearchBoard): ScoredMove[] {
  const withRisk = pool.map((entry) => {
    board.play(entry.move);
    const risk = hangRisk(board);
    board.undo();
    return { ...entry, risk };
  });
  const minRisk = Math.min(...withRisk.map((entry) => entry.risk));
  return withRisk.filter((entry) => entry.risk === minRisk);
}

const NEAR_BEST_MARGIN = 0.3;

/**
 * One depth of the root move loop: alpha rises across siblings as usual so pruning actually
 * engages (root search is otherwise close to unpruned: the first ply never repeats a position to
 * reuse a bound from). A move that fails low only gets a bound, not an exact score, but that bound
 * is already below `alpha - NEAR_BEST_MARGIN`, so it is correctly excluded from the near-best pool
 * either way.
 */
function searchRoot(
  ordered: readonly Move[],
  board: SearchBoard,
  def: GameRulesDef,
  needsPieces: boolean,
  depth: number,
): ScoredMove[] {
  let alpha = -Infinity;
  const scored: ScoredMove[] = [];
  for (const move of ordered) {
    board.play(move);
    const score = -negamax(board, def, needsPieces, depth - 1, -Infinity, -alpha, 1, move);
    board.undo();
    scored.push({ move, score });
    if (score > alpha) {
      alpha = score;
    }
  }
  return scored;
}

/**
 * Searches to `level.depth`, one ply at a time (iterative deepening): each shallower pass orders
 * the next one by its own best-first, so alpha rises quickly once the real depth is reached and
 * most root siblings cut off fast, instead of the near-unpruned root a single depth-4 pass is.
 * The shallow passes this repeats are cheap next to the final one (each roughly a `branching`th of
 * the next), so the added work is small next to what better ordering saves.
 */
function chooseBySearch(
  candidates: readonly Move[],
  board: SearchBoard,
  def: GameRulesDef,
  level: BotLevel,
  random: Random,
): Move {
  const needsPieces = needsPiecesForTerminal(def);
  let ordered = orderMoves(candidates);
  let scored: ScoredMove[] = [];
  for (let depth = 1; depth <= level.depth; depth += 1) {
    scored = searchRoot(ordered, board, def, needsPieces, depth);
    ordered = [...scored].sort((a, b) => b.score - a.score).map((entry) => entry.move);
  }
  const best = Math.max(...scored.map((entry) => entry.score));
  let pool = scored.filter((entry) => best - entry.score <= NEAR_BEST_MARGIN);
  if (level.level === 5) {
    pool = preferSafe(pool, board);
  }
  return pickUniform(
    pool.map((entry) => entry.move),
    random,
  );
}

/**
 * The single best move at `depth` plies for the side to move, by the same iterative-deepening
 * alpha-beta search `chooseBySearch` uses — but no randomness and no near-best pool: exactly one,
 * highest-scoring move. Used by `mateHint` (`domain/bot/hint.ts`), not by `chooseMove`'s own
 * probability-weighted levels.
 */
export function searchBestMove(state: GameState, rules: ChessRules, depth: number): Move | null {
  const legalMoves = rules.legalMoves(state.position);
  if (legalMoves.length === 0) {
    return null;
  }
  const board = rules.searchBoard(state.position);
  const needsPieces = needsPiecesForTerminal(state.def);
  let ordered = orderMoves(legalMoves);
  let scored: ScoredMove[] = [];
  for (let d = 1; d <= depth; d += 1) {
    scored = searchRoot(ordered, board, state.def, needsPieces, d);
    ordered = [...scored].sort((a, b) => b.score - a.score).map((entry) => entry.move);
  }
  let best: ScoredMove | undefined;
  for (const entry of scored) {
    if (best === undefined || entry.score > best.score) {
      best = entry;
    }
  }
  return best?.move ?? null;
}

/**
 * Picks the level's next move. `alwaysMateInOne` levels take a forced mate (or immediate variant
 * win) first; otherwise a die roll against `random` / `shallow` / the rest (search) picks the mode,
 * after the "queen stays home" window (if any) trims the candidate list. `null` only when there is
 * no legal move at all (the caller should not still be asking).
 */
export function chooseMove(
  state: GameState,
  level: BotLevel,
  rules: ChessRules,
  random: Random,
): Move | null {
  const legalMoves = rules.legalMoves(state.position);
  if (legalMoves.length === 0) {
    return null;
  }

  const board = rules.searchBoard(state.position);

  if (level.alwaysMateInOne) {
    const forced = findImmediateWin(state.def, board, legalMoves);
    if (forced !== null) {
      return forced;
    }
  }

  const candidates = applyQueenHome(legalMoves, state, level, rules);
  const roll = random.next();

  if (roll < level.random) {
    return pickUniform(candidates, random);
  }
  if (level.depth <= 0 || roll < level.random + level.shallow) {
    return chooseShallow(candidates, board, state.def, random);
  }
  return chooseBySearch(candidates, board, state.def, level, random);
}
