// The chess `SubjectWeb` pack (docs/refactor-v4.md §11) — temporary home until m8.18 moves it to
// `subject-chess/src/web`. Every platform-bound module reaches chess only through this file.
import { chessCore } from '@chess-kids/core/chess';
import type { BotPlayer } from '@chess-kids/core/chess';
import { createWorkerBotPlayer } from './adapters/bot/worker-bot-player.ts';
import type { SubjectServices, SubjectWeb } from './app/subject.ts';

declare module './app/subject.ts' {
  interface SubjectServices {
    readonly botPlayer: BotPlayer;
  }
}

function createChessServices(): SubjectServices {
  return { botPlayer: createWorkerBotPlayer() };
}

export const chessWeb = {
  core: chessCore,
  createServices: createChessServices,
} satisfies SubjectWeb;
