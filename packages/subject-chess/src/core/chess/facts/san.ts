import type { Move } from '../rules.ts';

/** Strips a trailing check/mate mark (`+`/`#`) so SAN comparisons ignore it (`Qh5+` vs `Qh5`). */
export function normalizeSan(san: string): string {
  return san.replace(/[+#]+$/, '');
}

export function sameSan(a: string, b: string): boolean {
  return normalizeSan(a) === normalizeSan(b);
}

export function findMoveBySan(moves: readonly Move[], san: string): Move | undefined {
  return moves.find((move) => sameSan(move.san, san));
}

export function givesCheck(san: string): boolean {
  return /[+#]$/.test(san);
}
