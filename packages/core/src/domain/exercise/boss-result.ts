/**
 * Legacy facade: reduces any boss/mini-game state (`static`, `series`, `versus`) to its attempt-log
 * fields via `modeOf` (`modes/index.ts`) instead of its own per-mode `if` chain. Shared by a
 * lesson's boss (`recordBossResult`) and the Play screen's standalone session
 * (`recordMiniGameResult`) — same mini-game modes, same fields either way.
 */
import type { BossResultSummary } from './mode.ts';
import type { MiniGameState } from './modes/index.ts';
import { modeOf } from './modes/index.ts';

export type { BossResultSummary };

/** Reduces `state` to its attempt-log fields, whichever mode played it. */
export function summarizeBossResult(state: MiniGameState): BossResultSummary {
  return modeOf(state).summarise(state);
}

/**
 * True when the boss/mini-game ended in a win, whichever mode played it. A finished `series`
 * always counts (it has no losing state, only a mistake count); `static`/`versus` only on an
 * actual win (not "ended"/"lost"/"draw").
 */
export function isBossResultWin(state: MiniGameState): boolean {
  return modeOf(state).isWin(state);
}
