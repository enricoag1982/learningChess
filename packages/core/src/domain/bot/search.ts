import type { ChessRules, Move, SearchBoard } from '../chess/rules.ts';
import type { Color, PieceType, Position, Square } from '../chess/types.ts';
import { evaluateTerminal } from '../game/index.ts';
import type { GameRulesDef, GameState } from '../game/index.ts';
import type { Random } from '../random.ts';
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

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null);
}

/** No killer moves for this ply — a shared constant so `orderMoves`'s default parameter never
 * allocates a fresh array on the (common) call with none to offer. */
const NO_KILLERS: readonly Move[] = [];

/** MVV score for a capture (highest-value victim first); `-1` for a non-capture, always below the
 * least valuable capture (pawn takes pawn scores `0`). Victim value only, no attacker (LVA)
 * tiebreak: adding one changed which of several same-value captures sorts first for every level,
 * not only Bear — and so, at Fox's shallow depth 2, which equally-scored move a `NEAR_BEST_MARGIN`
 * pool ends up offering `pickUniform`, which measurably (if narrowly) changed Fox's own endgame
 * conversion rate (`packages/content`'s `first-game` winnability check, 80% → 75% over 40 seeds) —
 * a real behaviour change to three levels with no documented speed problem, for a tiebreak whose
 * own benefit is marginal next to `tt`/`killers`/`quiesce` (Bear-only, see `negamax`). */
function captureScore(move: Move): number {
  if (move.captured === undefined) {
    return -1;
  }
  return PIECE_VALUE[move.captured];
}

/** History-heuristic key: colour + from + to (no piece/promotion — a quiet move's own identity is
 * fully carried by which square moved where, for the colour whose history table this scores). */
function historyKey(move: Move): string {
  return `${move.color}${move.from}${move.to}`;
}

/** History heuristic (`docs/computer-opponent.md` §3/§8, Bear-only — see `negamax`'s doc comment
 * on why every one of these tables is scoped to Bear alone): a quiet move that caused a beta
 * cutoff anywhere in this `chooseBySearch` call, weighted by the depth it cut off at (a cutoff deep
 * in the tree says more than one a ply from a leaf), read back by `orderMoves` as a tiebreak below
 * captures/TT/killers — the same "try what worked before, elsewhere in the tree, first" idea as
 * killer moves, but keyed by the move itself (not just the ply) so it also helps order moves at a
 * *different* ply that killers never reach. */
type HistoryTable = Map<string, number>;

function recordHistory(history: HistoryTable, move: Move, depth: number): void {
  const key = historyKey(move);
  history.set(key, (history.get(key) ?? 0) + depth * depth);
}

/**
 * Move ordering for one search node (`docs/computer-opponent.md` §3/§8 "Bear speed"): the
 * transposition-table move from a previous pass first (it is this node's best move so far — trying
 * it first lets alpha-beta prune the rest fastest), then captures by MVV-LVA, then this ply's
 * killer moves (quiet moves that caused a beta cutoff at the same ply elsewhere in the tree), then
 * every other quiet move by its history score (Bear only — `history` is `undefined` for every other
 * level, same as before this table existed), then the rest in generation order. Skips the sort on a
 * node where none of that applies (most nodes, deep in the tree, with no captures, no TT hit, no
 * killer and an empty/no history table) — cheap and worth checking first, since this runs at every
 * node.
 */
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

/** Killer moves that caused a beta cutoff, per ply from the search root; at most `MAX_KILLERS_PER_PLY` each. */
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

/** One node's cached search result, keyed by `SearchBoard.hash()` (`docs/computer-opponent.md`
 * §3/§8): `exact` when the true value was found, `lower`/`upper` when only a bound was (the search
 * stopped early on a cutoff) — same fail-soft convention `negamax` already returns. */
interface TTEntry {
  readonly depth: number;
  readonly score: number;
  readonly flag: 'exact' | 'lower' | 'upper';
  readonly move?: Move;
}

type TranspositionTable = Map<bigint, TTEntry>;

/** Any score at least this close to `WIN_SCORE` (either sign) is a mate score, not a material one
 * (`terminalScore` never returns anything between an ordinary material eval and `WIN_SCORE - a
 * handful of plies`) — used to convert a mate score to/from the TT's node-relative storage below. */
const MATE_THRESHOLD = WIN_SCORE - 200;

/**
 * `terminalScore` counts mate distance from the whole search's root (`WIN_SCORE - plyFromRoot`),
 * so the same mate found again through a transposition at a *different* `plyFromRoot` is a
 * different number of plies away — storing the raw root-relative score in `tt` would return a
 * stale distance (or even the wrong side's mate) the next time it is probed. Converting to
 * node-relative (`score ± plyFromRoot`) before storing, and back after probing, keeps every mate
 * score correct regardless of which branch reaches that node. A plain material score is unaffected
 * (never close to `WIN_SCORE`), so this is a no-op for the overwhelming majority of nodes.
 */
function toTT(score: number, plyFromRoot: number): number {
  if (score >= MATE_THRESHOLD) {
    return score + plyFromRoot;
  }
  if (score <= -MATE_THRESHOLD) {
    return score - plyFromRoot;
  }
  return score;
}

/** Inverse of `toTT` — node-relative back to this probe's own root-relative distance. */
function fromTT(score: number, plyFromRoot: number): number {
  if (score >= MATE_THRESHOLD) {
    return score - plyFromRoot;
  }
  if (score <= -MATE_THRESHOLD) {
    return score + plyFromRoot;
  }
  return score;
}

/**
 * Bear-only search extras, bundled into one optional parameter instead of three separate ones
 * threaded through `negamax`/`quiesce`/`searchRoot`/`chooseBySearch` (`docs/computer-opponent.md`
 * §3/§8): `quiescenceDepth` (unchanged from before this bundle existed), `rules` (needed only to
 * build the position `negamax` searches after a null move — see `tryNullMove` — every other
 * function here already gets its board from the caller), and `history` (the table above).
 * `undefined` for every level but Bear, same as `quiescenceDepth` alone used to be — so this is a
 * rename, not a new behaviour, for anything that stays `undefined`.
 */
interface BearSearch {
  readonly quiescenceDepth: number;
  readonly rules: ChessRules;
  readonly history: HistoryTable;
}

/** Plies of reduction for a null-move search (`tryNullMove`): standard `R = 2`. */
const NULL_MOVE_REDUCTION = 2;

/** Never tries a null move below this depth — `depth - 1 - NULL_MOVE_REDUCTION` must stay ≥ 0, and
 * a null move this close to a leaf has too little search left under it to say anything useful. */
const NULL_MOVE_MIN_DEPTH = 3;

/** A null move that flips `toMove` with nothing else changed would wrongly leave an en passant
 * capture on the table that was never really available (nobody just played the double step that
 * creates one) — standard null-move handling clears it. Castling rights are untouched: passing the
 * move affects neither side's own right to castle later. */
function nullMovePosition(position: Position): Position {
  return { ...position, toMove: other(position.toMove), enPassant: null };
}

/** Null-move pruning's own "not in a likely zugzwang" guard (`tryNullMove`): skip when the side to
 * move has only its king and pawns left, the position class where "passing" can be *better* than
 * every legal move (the whole idea a null move tests), so the pruning it enables is unsound there. */
function hasNonPawnMaterial(pieces: Position['pieces'], color: Color): boolean {
  return Object.values(pieces).some(
    (piece) => piece.color === color && piece.type !== 'p' && piece.type !== 'k',
  );
}

/**
 * Null-move pruning (`docs/computer-opponent.md` §3/§8 "Bear speed"): before searching this node's
 * own moves, asks "if the side to move got a free pass, would the opponent's best reply still stay
 * at or below `beta`?" at a shallow, reduced depth. A wide-open, quiet, roughly-equal position is
 * exactly the case flagged in §6.5/§9 as Bear's weak spot — most legal moves there score near-
 * identically, which is also exactly when a free pass still fails to reach `beta`: the position was
 * never in danger of dropping below it in the first place, so the *actual* move search below can be
 * skipped outright. Returns a fail-soft score `>= beta` on a successful cutoff, `null` otherwise (no
 * conclusion — the normal move loop runs as usual). Guards: not in check (a null move cannot escape
 * one), not already searching for a mate score either side (`Math.abs(beta) < MATE_THRESHOLD` — a
 * null move's own shallow reply search is a poor judge of an actual mate line), and not a likely
 * zugzwang position (`hasNonPawnMaterial`). Builds a fresh `SearchBoard` from the flipped position
 * (`nullMovePosition`) rather than reaching into `board`'s own undo stack for a "move" that is not
 * really a legal chess move — cheap next to a real subtree, since this only ever runs at `depth >=
 * NULL_MOVE_MIN_DEPTH` (a handful of nodes near the root of Bear's own shallow, depth-4 tree, not
 * the hot per-node path the rest of this file is written for). At Bear's own shallow depth the
 * reduced verification is often no more than a single quiescence call (`depth - 1 - R` bottoms out
 * at 0) — measured (`packages/core/scripts/calibrate.ts`, `docs/computer-opponent.md` §9) against a
 * same-size baseline sample rather than trusted on theory alone, since a shallow-verification
 * technique like this is exactly the kind small-sample calibration noise can make look like a
 * regression (or an improvement) that a same-seed baseline comparison shows is not there. */
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

/** Late move reductions (`docs/computer-opponent.md` §3/§8 "Bear speed"): a quiet move ordered
 * late (`orderMoves` already tried the TT move, captures and killers first — by this index, none
 * of those explain why it might be good) is searched one ply shallower first; only a move that
 * still beats `alpha` at that reduced depth earns the full-depth re-search `negamax`'s own loop
 * would otherwise always pay for. Skips a move that gives check (a check is never "quiet" in the
 * sense this reduction assumes — it forces a reply, so judging it at a shallower depth is more
 * likely to misjudge it) and the first `LMR_FULL_MOVE_COUNT` moves at a node (ordering already put
 * the moves most likely to matter there). */
const LMR_MIN_DEPTH = 3;
const LMR_FULL_MOVE_COUNT = 3;
const LMR_REDUCTION = 1;

/** Thrown to unwind a search past its `TIME_BUDGET_MS` deadline (see `chooseBySearch`); caught
 * only where it is thrown from, so it never escapes as a real error. */
class SearchAborted extends Error {
  constructor() {
    super('search aborted: past its time budget');
  }
}

/** How often (in visited nodes) `negamax`/`quiesce` check the deadline — a `performance.now()`
 * call at every single node would itself cost more than it saves. */
const DEADLINE_CHECK_INTERVAL = 256;

/** Mutable node counter threaded through one `chooseBySearch`/`searchBestMove` call, so
 * `negamax`/`quiesce` can check the deadline every `DEADLINE_CHECK_INTERVAL` nodes without passing
 * the count back up through every return. */
interface SearchClock {
  nodes: number;
  readonly deadline: number;
}

/** Ticks `clock` and throws `SearchAborted` once past `clock.deadline` (checked only ever
 * `DEADLINE_CHECK_INTERVAL` nodes — see `DEADLINE_CHECK_INTERVAL`). */
function checkDeadline(clock: SearchClock): void {
  clock.nodes += 1;
  if (clock.nodes % DEADLINE_CHECK_INTERVAL === 0 && performance.now() >= clock.deadline) {
    throw new SearchAborted();
  }
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

/** Plies of captures-only search past `negamax`'s normal horizon, Bear only (`level.level === 5`,
 * `docs/computer-opponent.md` §3/§8: "Level 5 quiescence (captures only, depth-capped) at the
 * leaves"). Judges a trade sequence started right at the search's own edge by where it actually
 * settles, instead of a static snapshot mid-exchange. Depth-capped so a wide-open middlegame with
 * many captures on the board still terminates quickly. */
const QUIESCENCE_DEPTH = 4;

/**
 * Captures-only search from a leaf `negamax` would otherwise statically evaluate (Bear's own
 * "capture check", see `QUIESCENCE_DEPTH`). Standard "stand pat" quiescence: the static value
 * always is a legal score (the side to move need not capture), so it bounds `alpha` from below
 * before any capture is tried; recursion is capped by `depthLeft`, not only by running out of
 * captures, so it always terminates.
 */
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
      // Always undo, even when `clock`'s deadline throws `SearchAborted` out of the recursive
      // call: `board` is shared for the rest of this `chooseBySearch` call (`preferSafe`, the next
      // depth's pass), so it must never be left with an un-undone move on an abort.
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

/**
 * Alpha-beta negamax. Checks `evaluateTerminal` at every node (a variant can win mid-tree, e.g.
 * capturing the flagged piece), not only at the leaves; `needsPieces` skips building the (more
 * costly) piece map for that check when the def has no such condition, which plain chess never
 * does — only checkmate, decided from the legal-move count and check flag alone.
 *
 * `tt`/`killers`/`quiesce`/null-move/LMR/history (`docs/computer-opponent.md` §3/§8/§9 "Bear
 * speed"/"Bear strength") are all scoped to Bear (`bear !== undefined`, this call's `useTt`) and
 * nowhere else: `tt` caches each node's
 * result by `SearchBoard.hash()` so a cutoff-strength entry (depth ≥ what is needed here)
 * short-circuits the node outright, its move seeding `orderMoves` even below that depth; `killers`
 * feeds the same ordering with quiet moves that cut off a sibling node at this ply before.
 * Rabbit/Fox/Wolf skip both and keep exactly their pre-M4.2 search: `tt`/`killers` reorder
 * equally-scored quiet moves (the *value* alpha-beta returns is unaffected — a transposition table
 * only prunes on a provably safe bound — but *which* equally-good move a shallow, `NEAR_BEST_MARGIN`
 * near-best pool then contains can shift), which measurably changed Fox's own endgame conversion
 * rate in `packages/content`'s `first-game` winnability check (80% → 75% over 40 seeds) — a cost
 * with no offsetting benefit at these levels, whose unoptimised depths (2-3) were never slow. Bear
 * (depth 4 + this quiescence) is the one level `docs/architecture.md` §11 actually flags as slow.
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
      // Late move reductions (Bear only, `LMR_MIN_DEPTH`'s own doc comment): a quiet move this far
      // down the already-good-first ordering, that does not itself give check, is tried one ply
      // shallower first — only re-searched at the full depth below when that still beats alpha.
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
/** Bear's own near-best margin: much tighter than `NEAR_BEST_MARGIN` (see `nearBestMargin`). */
const BEAR_NEAR_BEST_MARGIN = 0.05;

/**
 * How close to the best score still counts as "near-best" (`chooseBySearch`'s pool, picked from
 * uniformly). `NEAR_BEST_MARGIN` for every search-based level but Bear, unchanged from before
 * M4.2 (Rabbit/Fox/Wolf's own play stays exactly as it was — see `negamax`'s own doc comment on
 * why `tt`/`killers` are scoped the same way). Calibration (`docs/computer-opponent.md` §8) showed
 * `NEAR_BEST_MARGIN` alone was far too loose for Bear once real self-play made testing it possible
 * for the first time: at a quiet position with no immediate tactics, `staticEval`'s own centre/
 * development bonuses are small (0.1-0.15 each), so 0.3 swept in nearly every legal move — 25 of
 * ~29 in one measured case, including outright bad ones (an aimless king move, a knight to the
 * rim) — and `bear vs wolf` won only 2/20 seeded games as a result, worse than chance. Bear is
 * the one level meant to "play sensibly" (`docs/computer-opponent.md` §2) at its strongest, so it
 * keeps a little variety (never fully deterministic) with a much narrower pool instead.
 */
function nearBestMargin(level: BotLevel): number {
  return level.level === 5 ? BEAR_NEAR_BEST_MARGIN : NEAR_BEST_MARGIN;
}

/**
 * One depth of the root move loop: alpha rises across siblings as usual so pruning actually
 * engages (root search is otherwise close to unpruned: the first ply never repeats a position to
 * reuse a bound from). A move that fails low only gets a bound, not an exact score, but that bound
 * is already below `alpha - NEAR_BEST_MARGIN`, so it is correctly excluded from the near-best pool
 * either way. `tt`/`killers` persist across the whole iterative-deepening run (`chooseBySearch`),
 * so a shallower pass's results seed a deeper pass's move ordering.
 */
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

/** Wall-clock budget for one `chooseBySearch` call (`docs/computer-opponent.md` §3/§8 "Bear
 * speed"). `checkDeadline` (via `clock`) can abort mid-depth, not only between depths — a single
 * depth-4 pass can itself run well past budget (measured ~1-4s unbounded on a middlegame position,
 * against this 250ms target), so an abort has to be able to interrupt it. An aborted depth's
 * partial `scored` is always discarded (`chooseBySearch`'s `catch`, `searchRoot`'s own
 * `board.undo()` on the way out keeps `board` itself consistent either way) — `chooseBySearch`
 * only ever uses a depth's results once that whole depth finished, so every depth it does use is a
 * complete, exact alpha-beta pass. The move that pass returns is therefore a deterministic function
 * of the position and seed (`docs/computer-opponent.md` §1 "Testable"); only *how many* depths a
 * call completes before the deadline can vary with machine load — `tt`/`killers` (plus the
 * reference-set performance test) keep that at `level.depth` on essentially every position on a
 * CI-sized machine, so this almost never actually bites in practice. */
const TIME_BUDGET_MS = 250;

/**
 * Searches to `level.depth`, one ply at a time (iterative deepening): each shallower pass orders
 * the next one by its own best-first, so alpha rises quickly once the real depth is reached and
 * most root siblings cut off fast, instead of the near-unpruned root a single depth-4 pass is.
 * The shallow passes this repeats are cheap next to the final one (each roughly a `branching`th of
 * the next), so the added work is small next to what better ordering saves. A single transposition
 * table and killer-move table are shared across every depth in this call (see `TIME_BUDGET_MS`).
 */
function chooseBySearch(
  candidates: readonly Move[],
  board: SearchBoard,
  def: GameRulesDef,
  level: BotLevel,
  random: Random,
  rules: ChessRules,
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
  for (let depth = 1; depth <= level.depth; depth += 1) {
    try {
      scored = searchRoot(ordered, board, def, needsPieces, depth, tt, killers, bear, clock);
    } catch (error) {
      if (error instanceof SearchAborted) {
        // Past budget mid-depth: `board` is already back to this call's own position (every
        // `board.play` on the aborted path was undone on the way out — see `negamax`/`quiesce`'s
        // `finally`), and `scored` still holds the last depth that fully completed.
        break;
      }
      throw error;
    }
    ordered = [...scored].sort((a, b) => b.score - a.score).map((entry) => entry.move);
    if (depth < level.depth && performance.now() >= clock.deadline) {
      break;
    }
  }
  if (scored.length === 0) {
    // Defensive only: even depth 1 never completed before the deadline (Bear's own quiescence
    // could in principle explode on a position with long forced capture chains). Falls back to a
    // plain 1-ply choice so a move is still returned — legal, if not this level's usual strength.
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

/**
 * The single best move at `depth` plies for the side to move, by the same iterative-deepening
 * alpha-beta search `chooseBySearch` uses — but no randomness and no near-best pool: exactly one,
 * highest-scoring move. Used by `mateHint` (`domain/bot/hint.ts`), not by `chooseMove`'s own
 * probability-weighted levels. No time budget (a depth-2 hint search never approaches one) and no
 * quiescence (a shallow nudge, not Bear's own tactical check).
 */
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

/**
 * Picks the level's next move. `alwaysMateInOne` levels take a forced mate (or immediate variant
 * win) first; then, while `level.book` and `book` (the compiled `bot-book.yaml`, passed in — see
 * `BotBook`) still has a line matching the game so far, a book move; otherwise a die roll against
 * `random` / `shallow` / the rest (search) picks the mode, after the "queen stays home" window (if
 * any) trims the candidate list. `null` only when there is no legal move at all (the caller should
 * not still be asking).
 */
export function chooseMove(
  state: GameState,
  level: BotLevel,
  rules: ChessRules,
  random: Random,
  book?: BotBook,
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
  return chooseBySearch(candidates, board, state.def, level, random, rules);
}

function pickUniform(moves: readonly Move[], random: Random): Move {
  const index = Math.min(moves.length - 1, Math.floor(random.next() * moves.length));
  const move = moves[index];
  if (move === undefined) {
    throw new Error('pickUniform: empty move list');
  }
  return move;
}
