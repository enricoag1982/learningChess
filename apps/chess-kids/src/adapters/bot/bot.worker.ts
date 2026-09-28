import type { Move, game } from '@learn/subject-chess';
import { bot, chessJsRules } from '@learn/subject-chess/bot-worker';
import { botBook } from './book.ts';
import type { BotRequest, BotResponse } from './protocol.ts';

/** The computer opponent's search, off the UI thread. No `WebWorker` lib in `tsconfig.json`
 * (conflicts with `DOM`), so `self` is cast to the `Worker` interface `DOM` already declares. */
const ctx: Worker = self as unknown as Worker;

function chooseMove(state: game.GameState, level: number, seed: number): Move | null {
  const botLevel = bot.BOT_LEVELS.find((entry) => entry.level === level);
  if (botLevel === undefined) {
    throw new Error(`bot.worker: unknown bot level ${String(level)}`);
  }
  return bot.chooseMove(state, botLevel, chessJsRules, bot.seededRandom(seed), botBook);
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
