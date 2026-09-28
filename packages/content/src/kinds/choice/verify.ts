import {
  chessJsRules,
  isDefended,
  pieceValue,
  type ChoiceDef,
  type Position,
} from '@learn/subject-chess';
import { classifyTrade } from '../common.ts';

/** A `choice` exercise's optional `verify` (`schema.ts`'s regex already restricts the shape). */
type ChoiceVerify =
  | { readonly kind: 'higher-value' }
  | { readonly kind: 'worth'; readonly value: number }
  | { readonly kind: 'trade'; readonly san: string }
  | { readonly kind: 'draw-kind' };

function parseChoiceVerify(raw: string): ChoiceVerify {
  if (raw === 'higher-value') return { kind: 'higher-value' };
  if (raw === 'draw-kind') return { kind: 'draw-kind' };
  if (raw.startsWith('worth ')) {
    return { kind: 'worth', value: Number(raw.slice('worth '.length)) };
  }
  return { kind: 'trade', san: raw.slice('trade '.length) };
}

/** Every option's piece value, or `null` (with an issue pushed) if any option is not a piece. */
function optionValues(
  exercise: ChoiceDef,
  verifyLabel: string,
  where: string,
  issues: string[],
): readonly number[] | null {
  const values = exercise.options.map((option) =>
    option.piece === undefined ? undefined : pieceValue(option.piece.type),
  );
  if (values.some((value) => value === undefined)) {
    issues.push(`${where}: verify "${verifyLabel}" requires every option to be a piece`);
    return null;
  }
  return values as number[];
}

function checkChoiceHigherValue(exercise: ChoiceDef, where: string, issues: string[]): void {
  const values = optionValues(exercise, 'higher-value', where, issues);
  if (values === null) return;
  const max = Math.max(...values);
  const winners = exercise.options.filter((_, index) => values[index] === max);
  const winner = winners[0];
  if (winners.length !== 1 || winner === undefined) {
    issues.push(`${where}: verify "higher-value" requires a unique highest-value option`);
    return;
  }
  if (winner.id !== exercise.answer) {
    issues.push(
      `${where}: verify "higher-value": answer should be "${winner.id}", the higher-value option`,
    );
  }
}

function checkChoiceWorth(
  exercise: ChoiceDef,
  target: number,
  where: string,
  issues: string[],
): void {
  const label = `worth ${String(target)}`;
  const values = optionValues(exercise, label, where, issues);
  if (values === null) return;
  const winners = exercise.options.filter((_, index) => values[index] === target);
  const winner = winners[0];
  if (winners.length !== 1 || winner === undefined) {
    issues.push(`${where}: verify "${label}" requires exactly one option worth ${String(target)}`);
    return;
  }
  if (winner.id !== exercise.answer) {
    issues.push(`${where}: verify "${label}": answer should be "${winner.id}"`);
  }
}

const TRADE_OPTION_IDS: ReadonlySet<string> = new Set(['good', 'equal', 'bad']);

function checkChoiceTrade(exercise: ChoiceDef, san: string, where: string, issues: string[]): void {
  const label = `trade ${san}`;
  const ids = new Set(exercise.options.map((option) => option.id));
  if (ids.size !== TRADE_OPTION_IDS.size || ![...TRADE_OPTION_IDS].every((id) => ids.has(id))) {
    issues.push(`${where}: verify "${label}" requires options ids "good", "equal", "bad"`);
    return;
  }
  const played = chessJsRules.play(exercise.position, san);
  if (played === null || played.move.captured === undefined) {
    issues.push(`${where}: verify "${label}" is not a legal capture in the position`);
    return;
  }
  const classification = classifyTrade(
    pieceValue(played.move.captured),
    pieceValue(played.move.piece),
    isDefended(exercise.position, played.move.to, chessJsRules),
  );
  if (classification !== exercise.answer) {
    issues.push(
      `${where}: verify "${label}" classifies as "${classification}", but answer is "${exercise.answer}"`,
    );
  }
}

/** `draw-kind`: a single static position classified from real chess rules only — checkmate and
 * stalemate both leave no legal move, but only stalemate (no check) is a draw. */
function classifyDrawKind(
  position: Position,
): 'stalemate' | 'insufficient-material' | 'not-a-draw' {
  const status = chessJsRules.status(position);
  if (status.checkmate) return 'not-a-draw';
  if (status.stalemate) return 'stalemate';
  if (status.insufficientMaterial) return 'insufficient-material';
  return 'not-a-draw';
}

const DRAW_KIND_OPTION_IDS: ReadonlySet<string> = new Set([
  'stalemate',
  'insufficient-material',
  'not-a-draw',
]);

function checkChoiceDrawKind(exercise: ChoiceDef, where: string, issues: string[]): void {
  const ids = new Set(exercise.options.map((option) => option.id));
  if (
    ids.size !== DRAW_KIND_OPTION_IDS.size ||
    ![...DRAW_KIND_OPTION_IDS].every((id) => ids.has(id))
  ) {
    issues.push(
      `${where}: verify "draw-kind" requires options ids "stalemate", "insufficient-material", "not-a-draw"`,
    );
    return;
  }
  const classification = classifyDrawKind(exercise.position);
  if (classification !== exercise.answer) {
    issues.push(
      `${where}: verify "draw-kind" classifies as "${classification}", but answer is "${exercise.answer}"`,
    );
  }
}

/** A `choice` exercise's optional `verify`: `higher-value`/`worth <n>` need every option to be a
 * piece; `trade <SAN>` classifies a kid capture; `draw-kind` classifies the position. Load-time only. */
export function checkChoiceVerify(
  exercise: ChoiceDef,
  verify: string | undefined,
  where: string,
  issues: string[],
): void {
  if (verify === undefined) {
    return;
  }
  const parsed = parseChoiceVerify(verify);
  if (parsed.kind === 'higher-value') {
    checkChoiceHigherValue(exercise, where, issues);
    return;
  }
  if (parsed.kind === 'draw-kind') {
    checkChoiceDrawKind(exercise, where, issues);
    return;
  }
  if (parsed.kind === 'worth') {
    checkChoiceWorth(exercise, parsed.value, where, issues);
    return;
  }
  checkChoiceTrade(exercise, parsed.san, where, issues);
}
