/** 3 clean, 2 with at most 1 error or 1 hint level, else 1; for kinds whose stars ignore move count. */
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
