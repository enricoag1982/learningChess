import type { bot } from '@chess-kids/core';
import raw from '@chess-kids/content/bot-book.json';

/**
 * The compiled opening book (`packages/content/bot-book.yaml`, built and validated by
 * `pnpm build` — `packages/content/src/bot-book-load.ts`), typed as `domain/bot`'s `BotBook`.
 * Same "the content build already checked this shape, this is a type conversion not a runtime
 * check" approach as `bundled-content-source.ts`'s `content`/`tracks`. Shared by the worker
 * (`bot.worker.ts`) and its in-thread fallback (`worker-bot-player.ts`) so both pass the same book
 * to `bot.chooseMove` — `domain` itself stays free of a dependency on `@chess-kids/content`.
 */
export const botBook = raw as unknown as bot.BotBook;
