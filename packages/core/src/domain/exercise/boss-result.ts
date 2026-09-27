// Legacy facade: reduces any boss/mini-game state to its attempt-log fields via `modeOf`, instead
// of its own per-mode `if` chain. Shared by a lesson's boss and the Play screen's standalone session.
import type { BossResultSummary } from './mode.ts';
import type { MiniGameState } from './modes/index.ts';
import { modeOf } from './modes/index.ts';

export type { BossResultSummary };

/** Reduces `state` to its attempt-log fields, whichever mode played it. */
export function summarizeBossResult(state: MiniGameState): BossResultSummary {
  return modeOf(state).summarise(state);
}

/** True when the boss/mini-game ended in a win. A finished `series` always counts (no losing state);
 * `static`/`versus` only on an actual win. */
export function isBossResultWin(state: MiniGameState): boolean {
  return modeOf(state).isWin(state);
}
