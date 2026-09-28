// Narrow entry for the bot worker: search + chess.js rules only, bypassing `./chess`'s barrel so
// the worker's (non-code-splitting) build never reaches `chess-core.ts`'s lazy backup shape.
export * as bot from './domain/bot/index.ts';
export { chessJsRules } from './domain/chess/chessjs-rules.ts';
