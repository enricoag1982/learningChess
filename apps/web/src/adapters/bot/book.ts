import type { bot } from '@learn/subject-chess';
import raw from '@chess-kids/content/bot-book.json';

/** The compiled opening book, validated at content build time, typed as `domain/bot`'s `BotBook`
 * (a type conversion, not a runtime check). Shared by the worker and its in-thread fallback. */
export const botBook = raw as unknown as bot.BotBook;
