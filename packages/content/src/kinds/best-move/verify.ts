import {
  castlingMoves,
  chessJsRules,
  enPassantMoves,
  givesCheck,
  isDefended,
  isInCheck,
  isSafe,
  kingSquare,
  normalizeSan,
  pieceValue,
  type BestMoveDef,
  type Color,
  type Position,
  type Square,
} from '@chess-kids/core/chess';
import { classifyTrade, rules } from '../common.ts';

/** A `best-move` exercise's optional `verify` (`schema.ts`'s regex already restricts the shape). */
type BestMoveVerify =
  | { readonly kind: 'attack' | 'save'; readonly square: Square }
  | {
      readonly kind:
        | 'take-free'
        | 'good-trade'
        | 'check'
        | 'escape-king'
        | 'escape-block'
        | 'escape-capture'
        | 'castle'
        | 'en-passant';
    };

function parseBestMoveVerify(raw: string): BestMoveVerify {
  const [kind, square] = raw.split(' ');
  if (kind === 'attack' || kind === 'save') {
    return { kind, square: square as Square };
  }
  return {
    kind: kind as
      | 'take-free'
      | 'good-trade'
      | 'check'
      | 'escape-king'
      | 'escape-block'
      | 'escape-capture'
      | 'castle'
      | 'en-passant',
  };
}

/** The exact set of legal kid moves (SAN) satisfying a `best-move` `verify` rule in `position`, or
 * `null` (issue pushed) when the rule's own precondition is not met. */
function computeVerifiedBestMoves(
  verify: BestMoveVerify,
  position: Position,
  where: string,
  verifyLabel: string,
  issues: string[],
): readonly string[] | null {
  const kidColor = position.toMove;
  const candidates = rules.legalMoves(position, { staticOpponent: true });

  if (verify.kind === 'attack') {
    const target = position.pieces[verify.square];
    if (target === undefined || target.color === kidColor) {
      issues.push(`${where}: verify "${verifyLabel}" requires an enemy piece on ${verify.square}`);
      return null;
    }
    const beforeAttackers = new Set(chessJsRules.attackers(position, verify.square, kidColor));
    return candidates
      .filter((move) => {
        const played = rules.play(position, { staticOpponent: true }, move.san);
        if (played === null) return false;
        const occupant = played.position.pieces[verify.square];
        if (occupant === undefined || occupant.color === kidColor) return false;
        const afterAttackers = chessJsRules.attackers(played.position, verify.square, kidColor);
        return afterAttackers.includes(move.to) && !beforeAttackers.has(move.from);
      })
      .map((move) => move.san);
  }

  if (verify.kind === 'save') {
    const target = position.pieces[verify.square];
    if (target === undefined || target.color !== kidColor) {
      issues.push(
        `${where}: verify "${verifyLabel}" requires the kid's own piece on ${verify.square}`,
      );
      return null;
    }
    if (isSafe(position, verify.square, chessJsRules)) {
      issues.push(`${where}: verify "${verifyLabel}" requires that piece to not be safe yet`);
      return null;
    }
    return candidates
      .filter((move) => {
        const played = rules.play(position, { staticOpponent: true }, move.san);
        if (played === null) return false;
        const finalSquare = move.from === verify.square ? move.to : verify.square;
        return isSafe(played.position, finalSquare, chessJsRules);
      })
      .map((move) => move.san);
  }

  if (verify.kind === 'take-free') {
    return candidates
      .filter((move) => move.captured !== undefined && !isDefended(position, move.to, chessJsRules))
      .map((move) => move.san);
  }

  if (verify.kind === 'castle') {
    return castlingMoves(candidates).map((move) => move.san);
  }

  if (verify.kind === 'en-passant') {
    return enPassantMoves(candidates, position).map((move) => move.san);
  }

  if (verify.kind === 'check') {
    // chess.js's verbose moves() already appends "+"/"#" based on the real resulting position —
    // the simplest way to ask "does this move give check".
    return candidates.filter((move) => givesCheck(move.san)).map((move) => move.san);
  }

  if (
    verify.kind === 'escape-king' ||
    verify.kind === 'escape-block' ||
    verify.kind === 'escape-capture'
  ) {
    const king = kingSquare(position, kidColor);
    if (king === undefined || !isInCheck(position, chessJsRules)) {
      issues.push(`${where}: verify "${verifyLabel}" requires the kid's king to be in check`);
      return null;
    }
    const opponentColor: Color = kidColor === 'w' ? 'b' : 'w';
    const checkers = new Set(chessJsRules.attackers(position, king, opponentColor));
    return candidates
      .filter((move) => {
        const capturesChecker = move.captured !== undefined && checkers.has(move.to);
        const isKingMove = move.from === king;
        if (verify.kind === 'escape-capture') return capturesChecker;
        if (verify.kind === 'escape-king') return isKingMove && !capturesChecker;
        return !isKingMove && !capturesChecker; // escape-block: the only other legal way out
      })
      .map((move) => move.san);
  }

  // good-trade
  return candidates
    .filter((move) => {
      if (move.captured === undefined) return false;
      const classification = classifyTrade(
        pieceValue(move.captured),
        pieceValue(move.piece),
        isDefended(position, move.to, chessJsRules),
      );
      return classification === 'good';
    })
    .map((move) => move.san);
}

/** A `best-move` exercise's optional `verify`: computes the exact set of legal kid moves satisfying
 * the named rule and fails the build unless `solutions` equals that set. Load-time only. */
export function checkBestMoveVerify(
  exercise: BestMoveDef,
  verify: string | undefined,
  where: string,
  issues: string[],
): void {
  if (verify === undefined) {
    return;
  }
  const parsed = parseBestMoveVerify(verify);
  const computed = computeVerifiedBestMoves(parsed, exercise.position, where, verify, issues);
  if (computed === null) {
    return; // precondition issue already pushed
  }
  if (computed.length === 0) {
    issues.push(`${where}: verify "${verify}" computed no matching move (unsolvable as authored)`);
    return;
  }
  const computedSet = new Set(computed.map(normalizeSan));
  const authoredSet = new Set(exercise.solutions.map(normalizeSan));
  const matches =
    computedSet.size === authoredSet.size && [...computedSet].every((san) => authoredSet.has(san));
  if (!matches) {
    const expected = [...computedSet].sort().join(', ');
    const authored = [...authoredSet].sort().join(', ');
    issues.push(
      `${where}: verify "${verify}": solutions should be [${expected}], authored [${authored}]`,
    );
  }
}

/** Every authored `solutions` SAN must be a legal kid move in the position. */
export function verify(exercise: BestMoveDef, where: string, issues: string[]): void {
  const legalSans = new Set(
    rules
      .legalMoves(exercise.position, { staticOpponent: true })
      .map((move) => normalizeSan(move.san)),
  );
  for (const solution of exercise.solutions) {
    if (!legalSans.has(normalizeSan(solution))) {
      issues.push(`${where}: solution "${solution}" is not a legal move in the position`);
    }
  }
}
