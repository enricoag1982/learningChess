import type { BotPlayer } from '../../core/app/bot-player.ts';
import type { Move } from '../../core/chess/rules.ts';
import type { Square } from '../../core/chess/types.ts';
import { chessJsRules } from '../../core/chess/chessjs-rules.ts';

/** A scripted `BotPlayer`: replies with the queued `from`/`to` moves in order. */
export function scriptedBotPlayer(
  moves: readonly { readonly from: Square; readonly to: Square }[],
): BotPlayer {
  let index = 0;
  return {
    chooseMove(state) {
      const queued = moves[index];
      index += 1;
      if (queued === undefined) return Promise.resolve(null);
      const legal = chessJsRules.legalMoves(state.position);
      const move: Move | undefined = legal.find(
        (candidate) => candidate.from === queued.from && candidate.to === queued.to,
      );
      return Promise.resolve(move ?? null);
    },
  };
}
