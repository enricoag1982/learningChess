import type { BotPlayer, Move, game } from '@chess-kids/core';
import { bot, chessJsRules } from '@chess-kids/core';
import { botBook } from './book.ts';
import type { BotRequest, BotResponse } from './protocol.ts';

/** In-thread fallback: the same search, run synchronously on the caller's own thread. */
function chooseMoveInThread(state: game.GameState, level: number, seed: number): Move | null {
  const botLevel = bot.BOT_LEVELS.find((entry) => entry.level === level);
  if (botLevel === undefined) {
    throw new Error(`worker-bot-player: unknown bot level ${String(level)}`);
  }
  return bot.chooseMove(state, botLevel, chessJsRules, bot.seededRandom(seed), botBook);
}

/**
 * `BotPlayer` backed by a module Web Worker (`bot.worker.ts`), so a Bear-depth search never blocks
 * the UI thread (`docs/architecture.md` §2). Falls back to running the search in-thread when
 * `Worker` is unavailable (jsdom / Vitest): same result, no background thread.
 */
export function createWorkerBotPlayer(): BotPlayer {
  if (typeof Worker === 'undefined') {
    return {
      chooseMove(state, level, seed) {
        return Promise.resolve(chooseMoveInThread(state, level, seed));
      },
    };
  }

  const worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (move: Move | null) => void; reject: (error: unknown) => void }
  >();

  worker.onmessage = (event: MessageEvent<BotResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (entry === undefined) {
      return;
    }
    pending.delete(response.id);
    if ('error' in response) {
      entry.reject(new Error(response.error));
    } else {
      entry.resolve(response.move);
    }
  };

  return {
    chooseMove(state, level, seed) {
      return new Promise<Move | null>((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolve, reject });
        const request: BotRequest = { id, state, level, seed };
        worker.postMessage(request);
      });
    },
  };
}
