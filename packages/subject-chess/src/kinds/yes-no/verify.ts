import {
  canCastle,
  canEnPassant,
  chessJsRules,
  isAttacked,
  isCheckmate,
  isDefended,
  isHanging,
  isInCheck,
  isInsufficientMaterial,
  isSafe,
  isStalemate,
  type Position,
  type Square,
  type YesNoDef,
} from '../../chess.ts';

/** A `yes-no` exercise's parsed `verify` field (`schema.ts`'s regex already restricts the shape). */
type VerifyFact =
  | { readonly kind: 'hanging' | 'attacked' | 'defended'; readonly square: Square }
  | { readonly kind: 'in-check' | 'checkmate' | 'stalemate' | 'insufficient-material' }
  | { readonly kind: 'can-castle'; readonly side: 'kingside' | 'queenside' }
  | { readonly kind: 'can-en-passant' };

function parseVerify(raw: string): VerifyFact {
  if (raw === 'can-en-passant') {
    return { kind: 'can-en-passant' };
  }
  if (raw.startsWith('can-castle ')) {
    return {
      kind: 'can-castle',
      side: raw.slice('can-castle '.length) as 'kingside' | 'queenside',
    };
  }
  const [kind, square] = raw.split(' ');
  if (
    kind === 'in-check' ||
    kind === 'checkmate' ||
    kind === 'stalemate' ||
    kind === 'insufficient-material'
  ) {
    return { kind };
  }
  return { kind: kind as 'hanging' | 'attacked' | 'defended', square: square as Square };
}

function computeVerifyFact(fact: VerifyFact, position: Position): boolean {
  if (fact.kind === 'hanging') return isHanging(position, fact.square, chessJsRules);
  if (fact.kind === 'attacked') return isAttacked(position, fact.square, chessJsRules);
  if (fact.kind === 'defended') return isDefended(position, fact.square, chessJsRules);
  if (fact.kind === 'in-check') return isInCheck(position, chessJsRules);
  if (fact.kind === 'checkmate') return isCheckmate(position, chessJsRules);
  if (fact.kind === 'stalemate') return isStalemate(position, chessJsRules);
  if (fact.kind === 'insufficient-material') return isInsufficientMaterial(position, chessJsRules);
  if (fact.kind === 'can-castle') return canCastle(position, fact.side, chessJsRules);
  return canEnPassant(position, chessJsRules);
}

/** A `yes-no` exercise's optional `verify`: computes the named rule fact on the position and fails
 * the build if it contradicts `answer`. Load-time only. */
export function checkYesNoVerify(
  exercise: YesNoDef,
  verify: string | undefined,
  where: string,
  issues: string[],
): void {
  if (verify === undefined) {
    return;
  }
  const fact = parseVerify(verify);
  const actual = computeVerifyFact(fact, exercise.position);
  if (actual !== exercise.answer) {
    const answerWord = exercise.answer ? 'yes' : 'no';
    issues.push(`${where}: verify "${verify}" is ${String(actual)}, but answer is "${answerWord}"`);
    return;
  }
  // "Not hanging" must also mean safe in real chess: a defended piece attacked by a cheaper one
  // still loses material, so such a position would teach "defended = safe" wrongly.
  if (
    fact.kind === 'hanging' &&
    !actual &&
    isAttacked(exercise.position, fact.square, chessJsRules) &&
    !isSafe(exercise.position, fact.square, chessJsRules)
  ) {
    issues.push(
      `${where}: verify "${verify}": the piece is defended but attacked by a cheaper piece (not safe); use another position`,
    );
  }
}
