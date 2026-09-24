import type { Move } from '../chess/rules.ts';
import type { Piece, Position, Square } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import { applyKidMove } from './apply-move.ts';
import type { ExerciseDef } from './types.ts';

/** One step of a solution line. */
export interface SolverMove {
  readonly from: Square;
  readonly to: Square;
}

type Goal = 'collect-stars' | 'capture';

function isGoalReached(position: Position, goal: Goal): boolean {
  if (goal === 'collect-stars') {
    return position.markers.stars.length === 0;
  }
  const kidColor = position.toMove;
  return !Object.values(position.pieces).some((piece) => piece.color !== kidColor);
}

/**
 * Deterministic key for everything move generation depends on: piece placement (square + colour +
 * type, sorted by square), castling rights and en passant square.
 */
function placementKey(position: Position): string {
  const placement = Object.entries(position.pieces)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([square, piece]) => `${square}${piece.color}${piece.type}`)
    .join(',');
  return `${placement}|${position.castling}|${position.enPassant ?? '-'}`;
}

/** Full search state key: piece placement plus remaining stars. */
function stateKey(position: Position): string {
  return `${placementKey(position)}|${[...position.markers.stars].sort().join(',')}`;
}

/**
 * Applies an already-legal move to the board, the way a static-opponent kid move always does:
 * turn stays with the kid, en passant right is cleared, and a landed-on star is collected.
 *
 * Move generation itself always goes through `VariantRules.legalMoves` (real chess.js rules,
 * walls included); this only replays a move that is already known to be legal, so it can update
 * the piece map directly instead of paying for a full chess.js round trip. That keeps the search
 * fast enough for lesson-sized positions (see the performance test).
 */
function applyForSearch(position: Position, move: Move, rules: VariantRules): Position {
  if (position.castling !== '-') {
    // Castling moves the rook and changes rights: replay through the rules instead.
    const applied = applyKidMove(position, rules, {
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
    });
    if (applied === null) {
      throw new Error(`solver: legal move rejected: ${move.san}`);
    }
    return applied.position;
  }
  const pieces: Partial<Record<Square, Piece>> = { ...position.pieces };
  if (move.captured !== undefined && pieces[move.to] === undefined) {
    // En passant: the captured pawn sits beside the destination, on the mover's own start rank.
    const enPassantSquare = `${move.to.slice(0, 1)}${move.from.slice(1, 2)}` as Square;
    Reflect.deleteProperty(pieces, enPassantSquare);
  }
  Reflect.deleteProperty(pieces, move.from);
  pieces[move.to] = { color: move.color, type: move.promotion ?? move.piece };

  const collectsStar = position.markers.stars.includes(move.to);
  const markers = collectsStar
    ? { ...position.markers, stars: position.markers.stars.filter((star) => star !== move.to) }
    : position.markers;

  return { ...position, pieces, markers, enPassant: null };
}

interface Node {
  readonly position: Position;
  readonly move: SolverMove | null;
  readonly parent: Node | null;
}

function pathTo(node: Node): SolverMove[] {
  const path: SolverMove[] = [];
  let current: Node | null = node;
  while (current !== null && current.move !== null) {
    path.unshift(current.move);
    current = current.parent;
  }
  return path;
}

/**
 * Shortest line of kid moves (opponent static) reaching `goal` from `position`, or `null` when
 * none exists within `maxDepth` plies. Breadth-first over `VariantRules.legalMoves`, deduplicated
 * by piece placement + remaining stars so lesson-sized positions (few kid pieces, up to ~8
 * stars/targets) solve quickly. Legal moves only ever depend on the piece placement (walls and
 * side to move are fixed for the whole search; stars never block movement), so they are cached
 * per placement instead of recomputed for every star subset that placement can appear with.
 */
export function solve(
  position: Position,
  rules: VariantRules,
  goal: Goal,
  maxDepth = 12,
): SolverMove[] | null {
  if (isGoalReached(position, goal)) {
    return [];
  }

  const legalMovesCache = new Map<string, Move[]>();
  function legalMoves(pos: Position): Move[] {
    const key = placementKey(pos);
    const cached = legalMovesCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const moves = rules.legalMoves(pos, { staticOpponent: true });
    legalMovesCache.set(key, moves);
    return moves;
  }

  const root: Node = { position, move: null, parent: null };
  let frontier: Node[] = [root];
  const visited = new Set<string>([stateKey(position)]);

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const move of legalMoves(node.position)) {
        const nextPosition = applyForSearch(node.position, move, rules);
        if (isGoalReached(nextPosition, goal)) {
          return pathTo({
            position: nextPosition,
            move: { from: move.from, to: move.to },
            parent: node,
          });
        }
        const key = stateKey(nextPosition);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        next.push({ position: nextPosition, move: { from: move.from, to: move.to }, parent: node });
      }
    }
    frontier = next;
  }
  return null;
}

/** Shortest solve length for `def` (collect-stars / capture only); `null` when unsolvable. Used by content tests. */
export function optimalMoves(def: ExerciseDef, rules: VariantRules): number | null {
  if (def.type === 'select-squares') {
    return null;
  }
  const line = solve(def.position, rules, def.type);
  return line === null ? null : line.length;
}
