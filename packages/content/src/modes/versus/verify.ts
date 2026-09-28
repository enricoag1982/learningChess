import type { VersusMiniGame } from '@learn/subject-chess';
import { chessJsRules, game, hasKing, hasPieceOf } from '@learn/subject-chess';
import type { ModeVerifyContext } from '../mode-content.ts';

/**
 * `versus` mini-game checks (domain-model.md §1.4: "position valid, win conditions valid"): the
 * board matches `rules.kings` (both present / both absent), and the game is not already over at
 * its own start position (an instant win/draw there means the boss is unplayable).
 */
export function verify(miniGame: VersusMiniGame, where: string, ctx: ModeVerifyContext): void {
  if (!hasPieceOf(miniGame.position, miniGame.position.toMove)) {
    ctx.issues.push(`${where}: side to move has no piece`);
  }
  if (
    miniGame.rules.kings &&
    (!hasKing(miniGame.position, 'w') || !hasKing(miniGame.position, 'b'))
  ) {
    ctx.issues.push(`${where}: rules.kings is true but the start position is missing a king`);
  }
  if (
    !miniGame.rules.kings &&
    (hasKing(miniGame.position, 'w') || hasKing(miniGame.position, 'b'))
  ) {
    ctx.issues.push(`${where}: rules.kings is false but the start position has a king`);
  }
  const started = game.startGame(miniGame.rules, miniGame.position);
  const result = game.gameResult(started, chessJsRules);
  if (result.kind !== 'ongoing') {
    ctx.issues.push(`${where}: the game is already over at its start position (${result.kind})`);
  }
}
