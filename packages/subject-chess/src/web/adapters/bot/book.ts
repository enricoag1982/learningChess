import type { bot } from '../../../chess.ts';
import raw from '../../../../dist/bot-book.json';

/** The compiled opening book (validated at content build time), typed as `bot.BotBook` (a type conversion, not a runtime
 * check); shared by the worker and its in-thread fallback. */
export const botBook = raw as unknown as bot.BotBook;
