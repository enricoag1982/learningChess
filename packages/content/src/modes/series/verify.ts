import type { SeriesMiniGame } from '@chess-kids/core';
import type { ModeVerifyContext } from '../mode-content.ts';

export function verify(miniGame: SeriesMiniGame, where: string, ctx: ModeVerifyContext): void {
  for (const [index, round] of miniGame.rounds.entries()) {
    const roundWhere = `${where}: rounds[${String(index)}]`;
    ctx.claimId(round.id, roundWhere);
    ctx.checkExercise(round, roundWhere);
  }
}
