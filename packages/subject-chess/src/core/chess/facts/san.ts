import type { Move } from '../rules.ts';

/** Strips a trailing check/mate mark (`+`/`#`) so SAN comparisons ignore it (`Qh5+` vs `Qh5`). */
export function normalizeSan(san: string): string {
  return san.replace(/[+#]+$/, '');
}

/** True when two SAN strings name the same move, a trailing check/mate mark ignored either way. */
export function sameSan(a: string, b: string): boolean {
  return normalizeSan(a) === normalizeSan(b);
}

/** The move in `moves` whose SAN matches `san` (check/mate marks ignored), if any. */
export function findMoveBySan(moves: readonly Move[], san: string): Move | undefined {
  return moves.find((move) => sameSan(move.san, san));
}

/** True when `san` gives check or checkmate (its own trailing `+`/`#` mark). */
export function givesCheck(san: string): boolean {
  return /[+#]$/.test(san);
}
