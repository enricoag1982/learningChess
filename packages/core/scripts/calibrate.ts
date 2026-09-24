import { bot, chessJsRules, game } from '../src/index.ts';
import { parseFen } from '../src/domain/chess/fen.ts';
import type { GameRulesDef } from '../src/domain/game/types.ts';
import type { Color } from '../src/domain/chess/types.ts';
import type { BotLevel } from '../src/domain/bot/levels.ts';

/**
 * Calibration self-play (`docs/computer-opponent.md` §8 "Calibration (nightly)", M4.2's own
 * `docs/computer-opponent.md` §5 target): plays each level a full standard game against the level
 * right below it, `N` seeded games each (default 40, `pnpm --filter @chess-kids/core calibrate 100`
 * for more), and prints win rates. Not part of `pnpm test` — self-play at Bear's depth is much too
 * slow for CI (a handful of minutes for the whole run); this is a manual tuning tool, run once per
 * change to `levels.ts` and read by a person, not asserted on.
 */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START_POSITION = parseFen(START_FEN);

const STANDARD: GameRulesDef = {
  kings: true,
  checkRules: true,
  noMoves: 'draw',
  win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
  moveLimit: 150,
};

/** Generous ply cap so a stuck-forever game (neither side ever mates) still ends deterministically. */
const MAX_PLIES = 400;

type Outcome = 'higher' | 'lower' | 'draw';

/** One game: `higher` plays `higherColor`, `lower` the other side. Independent seeded `Random`
 * streams per side keep every seed's game reproducible on its own. */
function playOne(higher: BotLevel, lower: BotLevel, seed: number, higherColor: Color): Outcome {
  let state = game.startGame(STANDARD, START_POSITION);
  const higherRandom = bot.seededRandom(seed * 2 + 1);
  const lowerRandom = bot.seededRandom(seed * 2 + 2);

  for (let ply = 0; ply < MAX_PLIES; ply += 1) {
    const result = game.gameResult(state, chessJsRules);
    if (result.kind === 'win') {
      return result.winner === higherColor ? 'higher' : 'lower';
    }
    if (result.kind === 'draw') {
      return 'draw';
    }
    const isHigherToMove = state.position.toMove === higherColor;
    const level = isHigherToMove ? higher : lower;
    const random = isHigherToMove ? higherRandom : lowerRandom;
    const move = bot.chooseMove(state, level, chessJsRules, random);
    if (move === null) {
      // No legal move outside checkmate/stalemate/draw (already handled above) should not happen
      // in a real game of chess; treat it as a loss for whichever side is stuck rather than crash.
      return isHigherToMove ? 'lower' : 'higher';
    }
    const played = game.playGameMove(state, chessJsRules, move);
    if (played === null) {
      throw new Error(`calibrate: ${level.name} produced an illegal move (seed ${String(seed)})`);
    }
    state = played.state;
  }
  return 'draw';
}

interface Pairing {
  readonly higher: BotLevel['name'];
  readonly lower: BotLevel['name'];
}

const PAIRINGS: readonly Pairing[] = [
  { higher: 'rabbit', lower: 'mouse' },
  { higher: 'fox', lower: 'rabbit' },
  { higher: 'wolf', lower: 'fox' },
  { higher: 'bear', lower: 'wolf' },
];

const TARGET_WIN_RATE = 0.7;

function levelNamed(name: BotLevel['name']): BotLevel {
  const level = bot.BOT_LEVELS.find((candidate) => candidate.name === name);
  if (level === undefined) {
    throw new Error(`calibrate: no such level "${name}"`);
  }
  return level;
}

const gamesArg = process.argv[2];
const N = gamesArg === undefined ? 40 : Number(gamesArg);
if (!Number.isInteger(N) || N <= 0) {
  throw new Error(`calibrate: expected a positive integer game count, got "${String(gamesArg)}"`);
}

console.log(
  `Calibration: ${String(N)} seeded games per pairing, target >= ${String(TARGET_WIN_RATE * 100)}% for the higher level.\n`,
);

let allOk = true;
for (const { higher: higherName, lower: lowerName } of PAIRINGS) {
  const higher = levelNamed(higherName);
  const lower = levelNamed(lowerName);
  const start = performance.now();

  let higherWins = 0;
  let lowerWins = 0;
  let draws = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    // Alternate colours across seeds so neither level always plays White.
    const higherColor: Color = seed % 2 === 0 ? 'w' : 'b';
    const outcome = playOne(higher, lower, seed, higherColor);
    if (outcome === 'higher') higherWins += 1;
    else if (outcome === 'lower') lowerWins += 1;
    else draws += 1;
  }

  const winRate = higherWins / N;
  const elapsedS = ((performance.now() - start) / 1000).toFixed(1);
  const status = winRate >= TARGET_WIN_RATE ? 'OK' : 'BELOW TARGET';
  if (winRate < TARGET_WIN_RATE) allOk = false;
  console.log(
    `${higherName} vs ${lowerName}: ${String(higherWins)}/${String(N)} wins ` +
      `(${(winRate * 100).toFixed(1)}%), ${String(lowerWins)} losses, ${String(draws)} draws ` +
      `— ${status} [${elapsedS}s]`,
  );
}

console.log(
  allOk
    ? '\nAll pairings meet the >= 70% target.'
    : '\nSome pairings are below target — consider tuning levels.ts.',
);
