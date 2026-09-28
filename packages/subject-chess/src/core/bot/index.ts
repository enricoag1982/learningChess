export type { BotAids, BotLevel } from './levels.ts';
export { BOT_LEVELS } from './levels.ts';

export type { BookLine, BotBook } from './book.ts';
export { bookCandidates, bookMove, MAX_BOOK_PLIES } from './book.ts';

export { chooseMove, searchBestMove } from './search.ts';

export type { MateHint } from './hint.ts';
export { MATE_HINT_AFTER_MOVES, mateHint, shouldOfferMateHint } from './hint.ts';

export type { Random } from '@learn/platform-core/domain/random';
export { seededRandom } from '@learn/platform-core/domain/random';
