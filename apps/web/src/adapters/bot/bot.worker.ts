import type { Move, game } from '@chess-kids/core';
import { bot, chessJsRules } from '@chess-kids/core';
import type { BotRequest, BotResponse } from './protocol.ts';

/**
 * The computer opponent's search, off the UI thread (`docs/architecture.md` §2). No `WebWorker`
 * lib in `tsconfig.json` (it conflicts with `DOM`, already needed everywhere else in this app), so
 * `self` is cast to the `Worker` interface `DOM` already declares: the same one-argument
 * `postMessage`/`onmessage` shape a dedicated worker's global scope has.
 */
const ctx: Worker = self as unknown as Worker;

function chooseMove(state: game.GameState, level: number, seed: number): Move | null {
  const botLevel = bot.BOT_LEVELS.find((entry) => entry.level === level);
  if (botLevel === undefined) {
    throw new Error(`bot.worker: unknown bot level ${String(level)}`);
  }
  return bot.chooseMove(state, botLevel, chessJsRules, bot.seededRandom(seed));
}

ctx.onmessage = (event: MessageEvent<BotRequest>) => {
  const { id, state, level, seed } = event.data;
  let response: BotResponse;
  try {
    response = { id, move: chooseMove(state, level, seed) };
  } catch (error) {
    response = { id, error: error instanceof Error ? error.message : String(error) };
  }
  ctx.postMessage(response);
};
