/**
 * Stars from errors + hint level: 3 clean, 2 with ≤1 error or ≤1 hint level, else 1. Shared by
 * every kind whose stars depend only on errors/hints, not a move count (select-squares, yes-no,
 * choice, best-move, mate-in-n).
 */
export function errorHintStars(hintLevel: 0 | 1 | 2 | 3, errors: number): 1 | 2 | 3 {
  if (hintLevel === 3) {
    return 1;
  }
  if (hintLevel === 0 && errors === 0) {
    return 3;
  }
  if (hintLevel <= 1 && errors <= 1) {
    return 2;
  }
  return 1;
}
