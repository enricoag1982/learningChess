import type { ChessRules, Move, SearchBoard } from '../chess/rules.ts';
import type { Color, PieceType, Position, Square } from '../chess/types.ts';
import { evaluateTerminal } from '../game/index.ts';
import type { GameRulesDef, GameState } from '../game/index.ts';
import type { Random } from '@learn/platform-core/domain/random';
import { bookMove } from './book.ts';
import type { BotBook } from './book.ts';
import {
  boardView,
  evaluateBoard,
  needsPiecesForTerminal,
  PIECE_VALUE,
  staticEval,
  terminalScore,
  WIN_SCORE,
} from './evaluate.ts';
import type { BotLevel } from './levels.ts';

// Alpha-beta move search (Bear adds tt/killers/history/null-move/LMR/quiescence; every other level
// runs the plain search). See `docs/computer-opponent.md` §3/§8.

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null);
}

// Shared constant so `orderMoves`'s default parameter never allocates on the common no-killers call.
const NO_KILLERS: readonly Move[] = [];

// MVV score for a capture (highest-value victim first); -1 for a non-capture, below every capture.
function captureScore(move: Move): number {
  if (move.captured === undefined) {
    return -1;
  }
  return PIECE_VALUE[move.captured];
}

// History-heuristic key: colour + from + to (a quiet move's identity, no piece/promotion needed).
function historyKey(move: Move): string {
  return `${move.color}${move.from}${move.to}`;
}

// Bear-only history heuristic: quiet moves that caused a cutoff elsewhere, weighted by depth.
type HistoryTable = Map<string, number>;

function recordHistory(history: HistoryTable, move: Move, depth: number): void {
  const key = historyKey(move);
  history.set(key, (history.get(key) ?? 0) + depth * depth);
}

// Move ordering: TT move first, then MVV captures, then this ply's killers, then history score
// (Bear only), then generation order. Skips the sort when none of that applies to this node.
function orderMoves(
  moves: readonly Move[],
  ttMove?: Move,
  killers: readonly Move[] = NO_KILLERS,
  history?: HistoryTable,
): Move[] {
  const hasCapture = moves.some((move) => move.captured !== undefined);
  const hasHistory = history !== undefined && history.size > 0;
  if (!hasCapture && ttMove === undefined && killers.length === 0 && !hasHistory) {
    return [...moves];
  }
  function score(move: Move): number {
    if (ttMove !== undefined && sameMove(move, ttMove)) {
      return 1_000_000;
    }
    const capture = captureScore(move);
    if (capture >= 0) {
      return 500_000 + capture;
    }
    const killerIndex = killers.findIndex((killer) => sameMove(killer, move));
    if (killerIndex !== -1) {
      return 100_000 - killerIndex;
    }
    return history?.get(historyKey(move)) ?? 0;
  }
  return [...moves].sort((a, b) => score(b) - score(a));
}

// Killer moves (caused a beta cutoff) per ply from the search root, at most MAX_KILLERS_PER_PLY each.
type Killers = Move[][];

const MAX_KILLERS_PER_PLY = 2;

function recordKiller(killers: Killers, ply: number, move: Move): void {
  const existing = killers[ply];
  if (existing === undefined) {
    killers[ply] = [move];
    return;
  }
  if (existing.some((killer) => sameMove(killer, move))) {
    return;
  }
  existing.unshift(move);
  if (existing.length > MAX_KILLERS_PER_PLY) {
    existing.length = MAX_KILLERS_PER_PLY;
  }
}

// One node's cached result, keyed by SearchBoard.hash(); `exact` when the true value was found,
// `lower`/`upper` when only a bound was (search stopped early on a cutoff).
interface TTEntry {
  readonly depth: number;
  readonly score: number;
  readonly flag: 'exact' | 'lower' | 'upper';
  readonly move?: Move;
}

type TranspositionTable = Map<bigint, TTEntry>;

// A score this close to WIN_SCORE is a mate score, not a material one; used to convert a mate
// score to/from the TT's node-relative storage below.
const MATE_THRESHOLD = WIN_SCORE - 200;

// terminalScore counts mate distance from the search root, so the same mate reached via a
// transposition at a different plyFromRoot needs re-basing before it is stored / after it is read.
function toTT(score: number, plyFromRoot: number): number {
  if (score >= MATE_THRESHOLD) {
    return score + plyFromRoot;
  }
  if (score <= -MATE_THRESHOLD) {
    return score - plyFromRoot;
  }
  return score;
}

function fromTT(score: number, plyFromRoot: number): number {
  if (score >= MATE_THRESHOLD) {
    return score - plyFromRoot;
  }
  if (score <= -MATE_THRESHOLD) {
    return score + plyFromRoot;
  }
  return score;
}

// Bear-only search extras bundled into one optional param: quiescenceDepth, rules (to build the
// post-null-move position) and the history table. undefined for every other level.
interface BearSearch {
  readonly quiescenceDepth: number;
  readonly rules: ChessRules;
  readonly history: HistoryTable;
}

const NULL_MOVE_REDUCTION = 2;

// Never null-moves below this depth: `depth - 1 - NULL_MOVE_REDUCTION` must stay >= 0.
const NULL_MOVE_MIN_DEPTH = 3;

// A null move must still clear en passant (nobody actually played the double step that made it
// available); castling rights are untouched since passing affects neither side's own right.
function nullMovePosition(position: Position): Position {
  return { ...position, toMove: other(position.toMove), enPassant: null };
}

// Null-move pruning is unsound in likely zugzwang: skip when the side to move has only king+pawns.
function hasNonPawnMaterial(pieces: Position['pieces'], color: Color): boolean {
  return Object.values(pieces).some(
    (piece) => piece.color === color && piece.type !== 'p' && piece.type !== 'k',
  );
}

// Null-move pruning: if a free pass still leaves the reply <= beta, skip this node's real moves. Guards: not in check, no mate
// score in flight, not likely zugzwang (`hasNonPawnMaterial`); returns a fail-soft score >= beta, or null.
function tryNullMove(
  board: SearchBoard,
  def: GameRulesDef,
  needsPieces: boolean,
  depth: number,
  beta: number,
  plyFromRoot: number,
  tt: TranspositionTable,
  killers: Killers,
  bear: BearSearch,
  clock: SearchClock,
): number | null {
  if (depth < NULL_MOVE_MIN_DEPTH || Math.abs(beta) >= MATE_THRESHOLD || board.inCheck()) {
    return null;
  }
  const position = board.position();
  if (!hasNonPawnMaterial(position.pieces, position.toMove)) {
    return null;
  }
  const nullBoard = bear.rules.searchBoard(nullMovePosition(position));
  const score = -negamax(
    nullBoard,
    def,
    needsPieces,
    depth - 1 - NULL_MOVE_REDUCTION,
    -beta,
    -beta + 1,
    plyFromRoot + 1,
    undefined,
    tt,
    killers,
    bear,
    clock,
  );
  return score >= beta ? score : null;
}

// Late move reductions: a late-ordered quiet move is searched one ply shallower first, and re-searched at full depth only if it
// beats alpha. Skips checks and the first LMR_FULL_MOVE_COUNT moves.
const LMR_MIN_DEPTH = 3;
const LMR_FULL_MOVE_COUNT = 3;
const LMR_REDUCTION = 1;

// Thrown to unwind a search past its time budget; caught only where thrown, never escapes as an error.
class SearchAborted extends Error {
  constructor() {
    super('search aborted: past its time budget');
  }
}

// How often (in visited nodes) the deadline is checked — a performance.now() call per node would
// itself cost more than it saves.
const DEADLINE_CHECK_INTERVAL = 256;

// Mutable node counter threaded through one search call so the deadline can be checked without
// passing the count back up through every return.
interface SearchClock {
  nodes: number;
  readonly deadline: number;
}

function checkDeadline(clock: SearchClock): void {
  clock.nodes += 1;
  if (clock.nodes % DEADLINE_CHECK_INTERVAL === 0 && performance.now() >= clock.deadline) {
    throw new SearchAborted();
  }
}

// A move that immediately wins for its own colour. Runs per candidate for every level but Mouse,
// so it uses the fast SearchBoard rather than rebuilding a chess.js instance each time.
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

// Drops queen moves during the level's opening "queen stays home" window, unless the queen is
// attacked or moving it is the only legal option.
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

// Plies of captures-only search past negamax's horizon, Bear only; depth-capped so a wide-open
// middlegame with many captures still terminates quickly.
const QUIESCENCE_DEPTH = 4;

// Standard "stand pat" quiescence: the static value already bounds alpha from below (the side to
// move need not capture), then captures are tried until depthLeft runs out.
function quiesce(
  board: SearchBoard,
  def: GameRulesDef,
  needsPieces: boolean,
  alpha: number,
  beta: number,
  plyFromRoot: number,
  depthLeft: number,
  lastMove: Move | undefined,
  clock: SearchClock,
): number {
  checkDeadline(clock);
  const moves = board.moves();
  const view = boardView(board, moves, needsPieces);
  const terminal = terminalScore(def, view, plyFromRoot, lastMove);
  if (terminal !== null) {
    return terminal;
  }
  const standPat = staticEval(needsPieces ? view : boardView(board, moves, true), def);
  if (standPat >= beta) {
    return beta;
  }
  let localAlpha = alpha > standPat ? alpha : standPat;
  if (depthLeft <= 0) {
    return localAlpha;
  }
  const captures = moves.filter((move) => move.captured !== undefined);
  for (const move of orderMoves(captures)) {
    board.play(move);
    let score: number;
    try {
      score = -quiesce(
        board,
        def,
        needsPieces,
        -beta,
        -localAlpha,
        plyFromRoot + 1,
        depthLeft - 1,
        move,
        clock,
      );
    } finally {
      // Always undo, even on an aborted search: `board` is shared for the rest of this call.
      board.undo();
    }
    if (score >= beta) {
      return score;
    }
    if (score > localAlpha) {
      localAlpha = score;
    }
  }
  return localAlpha;
}

// Alpha-beta negamax; checks evaluateTerminal at every node (a variant can win mid-tree). tt / killers / quiesce / null-move /
// LMR / history are Bear-only (`bear !== undefined`); other levels run the plain search.
function negamax(
  board: SearchBoard,
  def: GameRulesDef,
  needsPieces: boolean,
  depth: number,
  alpha: number,
  beta: number,
  plyFromRoot: number,
  lastMove: Move | undefined,
  tt: TranspositionTable,
  killers: Killers,
  bear: BearSearch | undefined,
  clock: SearchClock,
): number {
  checkDeadline(clock);
  const useTt = bear !== undefined;
  const hash = useTt ? board.hash() : 0n;
  const ttEntry = useTt ? tt.get(hash) : undefined;
  if (ttEntry !== undefined && ttEntry.depth >= depth) {
    const score = fromTT(ttEntry.score, plyFromRoot);
    if (ttEntry.flag === 'exact') {
      return score;
    }
    if (ttEntry.flag === 'lower' && score >= beta) {
      return score;
    }
    if (ttEntry.flag === 'upper' && score <= alpha) {
      return score;
    }
  }

  const moves = board.moves();
  const view = boardView(board, moves, needsPieces);
  const terminal = terminalScore(def, view, plyFromRoot, lastMove);
  if (terminal !== null) {
    return terminal;
  }
  if (depth === 0) {
    return bear === undefined
      ? staticEval(needsPieces ? view : boardView(board, moves, true), def)
      : quiesce(
          board,
          def,
          needsPieces,
          alpha,
          beta,
          plyFromRoot,
          bear.quiescenceDepth,
          lastMove,
          clock,
        );
  }

  if (bear !== undefined) {
    const pruned = tryNullMove(
      board,
      def,
      needsPieces,
      depth,
      beta,
      plyFromRoot,
      tt,
      killers,
      bear,
      clock,
    );
    if (pruned !== null) {
      return pruned;
    }
  }

  let best = -Infinity;
  let bestMove: Move | undefined;
  let localAlpha = alpha;
  const nodeKillers = killers[plyFromRoot] ?? NO_KILLERS;
  const ordered = orderMoves(moves, ttEntry?.move, nodeKillers, bear?.history);
  for (const [index, move] of ordered.entries()) {
    board.play(move);
    let score: number;
    try {
      const isQuiet = move.captured === undefined;
      const isPriority =
        (ttEntry?.move !== undefined && sameMove(move, ttEntry.move)) ||
        nodeKillers.some((killer) => sameMove(killer, move));
      const reducible =
        bear !== undefined &&
        depth >= LMR_MIN_DEPTH &&
        index >= LMR_FULL_MOVE_COUNT &&
        isQuiet &&
        !isPriority &&
        !board.inCheck();
      const reduction = reducible ? LMR_REDUCTION : 0;
      score = -negamax(
        board,
        def,
        needsPieces,
        depth - 1 - reduction,
        -beta,
        -localAlpha,
        plyFromRoot + 1,
        move,
        tt,
        killers,
        bear,
        clock,
      );
      if (reduction > 0 && score > localAlpha) {
        score = -negamax(
          board,
          def,
          needsPieces,
          depth - 1,
          -beta,
          -localAlpha,
          plyFromRoot + 1,
          move,
          tt,
          killers,
          bear,
          clock,
        );
      }
    } finally {
      board.undo();
    }
    if (score > best) {
      best = score;
      bestMove = move;
    }
    if (best > localAlpha) {
      localAlpha = best;
    }
    if (localAlpha >= beta) {
      if (bear !== undefined && move.captured === undefined) {
        recordKiller(killers, plyFromRoot, move);
        recordHistory(bear.history, move, depth);
      }
      break;
    }
  }
  if (useTt) {
    const flag: TTEntry['flag'] = best <= alpha ? 'upper' : best >= beta ? 'lower' : 'exact';
    tt.set(hash, {
      depth,
      score: toTT(best, plyFromRoot),
      flag,
      ...(bestMove ? { move: bestMove } : {}),
    });
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

// Opponent's best immediate capture value after this move — a simple "does this hang a piece?" check.
function hangRisk(board: SearchBoard): number {
  let risk = 0;
  for (const reply of board.moves()) {
    if (reply.captured !== undefined) {
      risk = Math.max(risk, PIECE_VALUE[reply.captured]);
    }
  }
  return risk;
}

// Bear's "capture check": among the near-best moves, prefer the ones that leave the least hanging.
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
// Bear's own near-best margin: much tighter than NEAR_BEST_MARGIN (see `nearBestMargin`).
const BEAR_NEAR_BEST_MARGIN = 0.05;

// Bear needs a much narrower near-best pool than the other levels to avoid picking outright weak
// moves while still keeping some variety (never fully deterministic).
function nearBestMargin(level: BotLevel): number {
  return level.level === 5 ? BEAR_NEAR_BEST_MARGIN : NEAR_BEST_MARGIN;
}

// One depth of the root move loop: alpha rises across siblings so pruning engages even though the
// root itself repeats no position. tt/killers persist across the whole iterative-deepening run.
function searchRoot(
  ordered: readonly Move[],
  board: SearchBoard,
  def: GameRulesDef,
  needsPieces: boolean,
  depth: number,
  tt: TranspositionTable,
  killers: Killers,
  bear: BearSearch | undefined,
  clock: SearchClock,
): ScoredMove[] {
  let alpha = -Infinity;
  const scored: ScoredMove[] = [];
  for (const move of ordered) {
    board.play(move);
    let score: number;
    try {
      score = -negamax(
        board,
        def,
        needsPieces,
        depth - 1,
        -Infinity,
        -alpha,
        1,
        move,
        tt,
        killers,
        bear,
        clock,
      );
    } finally {
      board.undo();
    }
    scored.push({ move, score });
    if (score > alpha) {
      alpha = score;
    }
  }
  return scored;
}

// Wall-clock budget for one chooseBySearch call; `checkDeadline` can abort mid-depth (a depth-4 pass may overrun it). Only a
// completed depth's result is used, so the move stays deterministic in position + seed.
const TIME_BUDGET_MS = 250;

/** One search's telemetry for tools (calibrate): last fully completed depth, the level's own depth, and
 * whether the time budget stopped it short. */
export interface SearchReport {
  readonly depth: number;
  readonly targetDepth: number;
  readonly cutByTime: boolean;
}

// Iterative deepening to level.depth: each shallower pass orders the next by its own best-first,
// so alpha rises quickly and most root siblings cut off fast. tt/killers are shared across depths.
function chooseBySearch(
  candidates: readonly Move[],
  board: SearchBoard,
  def: GameRulesDef,
  level: BotLevel,
  random: Random,
  rules: ChessRules,
  onSearch?: (report: SearchReport) => void,
): Move {
  const needsPieces = needsPiecesForTerminal(def);
  const bear: BearSearch | undefined =
    level.level === 5
      ? { quiescenceDepth: QUIESCENCE_DEPTH, rules, history: new Map<string, number>() }
      : undefined;
  const tt: TranspositionTable = new Map();
  const killers: Killers = [];
  const clock: SearchClock = { nodes: 0, deadline: performance.now() + TIME_BUDGET_MS };
  let ordered = orderMoves(candidates);
  let scored: ScoredMove[] = [];
  let completedDepth = 0;
  for (let depth = 1; depth <= level.depth; depth += 1) {
    try {
      scored = searchRoot(ordered, board, def, needsPieces, depth, tt, killers, bear, clock);
      completedDepth = depth;
    } catch (error) {
      if (error instanceof SearchAborted) {
        // Past budget mid-depth: board is already undone back to this call's own position, and
        // `scored` still holds the last depth that fully completed.
        break;
      }
      throw error;
    }
    ordered = [...scored].sort((a, b) => b.score - a.score).map((entry) => entry.move);
    if (depth < level.depth && performance.now() >= clock.deadline) {
      break;
    }
  }
  onSearch?.({
    depth: completedDepth,
    targetDepth: level.depth,
    cutByTime: completedDepth < level.depth,
  });
  if (scored.length === 0) {
    // Defensive only: even depth 1 never completed. Falls back to a plain 1-ply choice.
    return chooseShallow(candidates, board, def, random);
  }
  const best = Math.max(...scored.map((entry) => entry.score));
  let pool = scored.filter((entry) => best - entry.score <= nearBestMargin(level));
  if (level.level === 5) {
    pool = preferSafe(pool, board);
  }
  return pickUniform(
    pool.map((entry) => entry.move),
    random,
  );
}

/** Best move at `depth` plies by the `chooseBySearch` search, without randomness or a near-best pool; used by `mateHint`. */
export function searchBestMove(state: GameState, rules: ChessRules, depth: number): Move | null {
  const legalMoves = rules.legalMoves(state.position);
  if (legalMoves.length === 0) {
    return null;
  }
  const board = rules.searchBoard(state.position);
  const needsPieces = needsPiecesForTerminal(state.def);
  const tt: TranspositionTable = new Map();
  const killers: Killers = [];
  const clock: SearchClock = { nodes: 0, deadline: Infinity };
  let ordered = orderMoves(legalMoves);
  let scored: ScoredMove[] = [];
  for (let d = 1; d <= depth; d += 1) {
    scored = searchRoot(ordered, board, state.def, needsPieces, d, tt, killers, undefined, clock);
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

/** Picks the level's next move: a forced mate/variant win first (if `alwaysMateInOne`), then a
 * book move, then random / shallow / search by die roll. `null` only with no legal move at all. */
export function chooseMove(
  state: GameState,
  level: BotLevel,
  rules: ChessRules,
  random: Random,
  book?: BotBook,
  onSearch?: (report: SearchReport) => void,
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

  if (level.book && book !== undefined) {
    const fromBook = bookMove(state, book, rules, random);
    if (fromBook !== null) {
      return fromBook;
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
  return chooseBySearch(candidates, board, state.def, level, random, rules, onSearch);
}

function pickUniform(moves: readonly Move[], random: Random): Move {
  const index = Math.min(moves.length - 1, Math.floor(random.next() * moves.length));
  const move = moves[index];
  if (move === undefined) {
    throw new Error('pickUniform: empty move list');
  }
  return move;
}
