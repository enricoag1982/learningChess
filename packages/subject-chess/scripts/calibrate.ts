import { bot, game } from '../src/chess.ts';
import { PIECE_VALUE } from '../src/core/bot/evaluate.ts';
import { chooseMove } from '../src/core/bot/search.ts';
import type { SearchReport } from '../src/core/bot/search.ts';
import { chessJsRules } from '../src/core/chess/chessjs-rules.ts';
import { parseFen } from '../src/core/chess/fen.ts';
import type { GameRulesDef, GameState } from '../src/core/game/types.ts';
import type { Color } from '../src/core/chess/types.ts';
import type { BotLevel } from '../src/core/bot/levels.ts';

/**
 * Calibration self-play (`docs/computer-opponent.md` §8 "Calibration (manual)",
 * §5 target): plays each level a full standard game against the level
 * right below it, `N` seeded games each (default 40, `pnpm --filter @learn/subject-chess calibrate 100`
 * for more), and prints W / D / L, the reason for every non-win and the higher level's search
 * depth. Not part of `pnpm test` — self-play at Bear's depth is much too
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

/** The higher level counts as "ahead" from this material lead (pawns). */
const AHEAD_LEAD = 3;

type Outcome = 'higher' | 'lower' | 'draw';

/** Pawns of material, `color`'s minus the other side's. */
function materialLead(state: GameState, color: Color): number {
  let lead = 0;
  for (const piece of Object.values(state.position.pieces)) {
    lead += (piece.color === color ? 1 : -1) * PIECE_VALUE[piece.type];
  }
  return lead;
}

interface GameReport {
  readonly seed: number;
  readonly higherColor: Color;
  readonly outcome: Outcome;
  /** Why it ended: `checkmate`, a draw reason, `ply-cap` or `no-moves`. */
  readonly reason: string;
  readonly plies: number;
  /** The higher level's material lead (pawns) at the end and at its best. */
  readonly finalLead: number;
  readonly peakLead: number;
  /** Plies where the higher level led by >= `AHEAD_LEAD`: ahead without converting shows up here. */
  readonly pliesAhead: number;
  /** Search reports for the higher level's own moves. */
  readonly searches: readonly SearchReport[];
}

/** One game: `higher` plays `higherColor`, `lower` the other side. Independent seeded `Random`
 * streams per side keep every seed's game reproducible on its own. */
function playOne(higher: BotLevel, lower: BotLevel, seed: number, higherColor: Color): GameReport {
  let state = game.startGame(STANDARD, START_POSITION);
  const higherRandom = bot.seededRandom(seed * 2 + 1);
  const lowerRandom = bot.seededRandom(seed * 2 + 2);
  const searches: SearchReport[] = [];
  let peakLead = 0;
  let pliesAhead = 0;

  const finish = (outcome: Outcome, reason: string, plies: number): GameReport => ({
    seed,
    higherColor,
    outcome,
    reason,
    plies,
    finalLead: materialLead(state, higherColor),
    peakLead,
    pliesAhead,
    searches,
  });

  for (let ply = 0; ply < MAX_PLIES; ply += 1) {
    const result = game.gameResult(state, chessJsRules);
    if (result.kind === 'win') {
      return finish(result.winner === higherColor ? 'higher' : 'lower', result.reason, ply);
    }
    if (result.kind === 'draw') {
      return finish('draw', result.reason, ply);
    }
    const isHigherToMove = state.position.toMove === higherColor;
    const level = isHigherToMove ? higher : lower;
    const random = isHigherToMove ? higherRandom : lowerRandom;
    const move = chooseMove(
      state,
      level,
      chessJsRules,
      random,
      undefined,
      isHigherToMove ? (report) => searches.push(report) : undefined,
    );
    if (move === null) {
      // No legal move outside checkmate/stalemate/draw (already handled above) should not happen
      // in a real game of chess; treat it as a loss for whichever side is stuck rather than crash.
      return finish(isHigherToMove ? 'lower' : 'higher', 'no-moves', ply);
    }
    const played = game.playGameMove(state, chessJsRules, move);
    if (played === null) {
      throw new Error(`calibrate: ${level.name} produced an illegal move (seed ${String(seed)})`);
    }
    state = played.state;
    const lead = materialLead(state, higherColor);
    peakLead = Math.max(peakLead, lead);
    if (lead >= AHEAD_LEAD) pliesAhead += 1;
  }
  return finish('draw', 'ply-cap', MAX_PLIES);
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index] ?? 0;
}

function countBy(items: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key} x${String(count)}`);
  return parts.length === 0 ? '-' : parts.join(', ');
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

/** Optional 3rd arg (`pnpm --filter @learn/subject-chess calibrate 15 bear`): only the pairing whose
 * `higher` level has this name — a quick smoke check while tuning one level (Bear
 * strength work, `docs/computer-opponent.md` §9) without paying for the other 3 pairings every
 * time. Omitted runs every pairing. */
const filterArg = process.argv[3];
const pairings =
  filterArg === undefined || filterArg === 'all'
    ? PAIRINGS
    : PAIRINGS.filter((p) => p.higher === filterArg);
if (pairings.length === 0) {
  throw new Error(`calibrate: no pairing has "${String(filterArg)}" as its higher level`);
}

/** Optional 4th arg: seeds run from `offset + 1` to `offset + N` (a second seed set, or one shard
 * of a parallel run). Keep it even so colours alternate the same way as without it. */
const offsetArg = process.argv[4];
const SEED_OFFSET = offsetArg === undefined ? 0 : Number(offsetArg);
if (!Number.isInteger(SEED_OFFSET) || SEED_OFFSET < 0) {
  throw new Error(
    `calibrate: expected a non-negative integer seed offset, got "${String(offsetArg)}"`,
  );
}

console.log(
  `Calibration: ${String(N)} seeded games per pairing (seeds ${String(SEED_OFFSET + 1)}..${String(SEED_OFFSET + N)}), target >= ${String(TARGET_WIN_RATE * 100)}% for the higher level.\n`,
);

let allOk = true;
for (const { higher: higherName, lower: lowerName } of pairings) {
  const higher = levelNamed(higherName);
  const lower = levelNamed(lowerName);
  const start = performance.now();

  const reports: GameReport[] = [];
  for (let seed = SEED_OFFSET + 1; seed <= SEED_OFFSET + N; seed += 1) {
    // Alternate colours across seeds so neither level always plays White.
    const higherColor: Color = seed % 2 === 0 ? 'w' : 'b';
    reports.push(playOne(higher, lower, seed, higherColor));
  }

  const higherWins = reports.filter((r) => r.outcome === 'higher').length;
  const lowerWins = reports.filter((r) => r.outcome === 'lower').length;
  const draws = reports.filter((r) => r.outcome === 'draw').length;
  const winRate = higherWins / N;
  const elapsedS = ((performance.now() - start) / 1000).toFixed(1);
  const status = winRate >= TARGET_WIN_RATE ? 'OK' : 'BELOW TARGET';
  if (winRate < TARGET_WIN_RATE) allOk = false;
  console.log(
    `${higherName} vs ${lowerName}: W/D/L ${String(higherWins)}/${String(draws)}/${String(lowerWins)} of ${String(N)} ` +
      `(${(winRate * 100).toFixed(1)}% wins) — ${status} [${elapsedS}s]`,
  );

  const nonWins = reports.filter((r) => r.outcome !== 'higher');
  console.log(
    `  draws by: ${countBy(nonWins.filter((r) => r.outcome === 'draw').map((r) => r.reason))}`,
  );
  console.log(
    `  losses by: ${countBy(nonWins.filter((r) => r.outcome === 'lower').map((r) => r.reason))}`,
  );
  console.log(
    `  wins by: ${countBy(reports.filter((r) => r.outcome === 'higher').map((r) => r.reason))}`,
  );
  for (const r of nonWins) {
    console.log(
      `  non-win seed ${String(r.seed)} ${higherName}=${r.higherColor}: ${r.outcome === 'draw' ? 'draw' : 'loss'} ` +
        `(${r.reason}) ply ${String(r.plies)}, lead end ${String(r.finalLead)} / peak ${String(r.peakLead)}, ` +
        `${String(r.pliesAhead)} plies ahead >= ${String(AHEAD_LEAD)}`,
    );
  }

  const searches = reports.flatMap((r) => r.searches);
  if (searches.length > 0) {
    const depths = searches.map((s) => s.depth).sort((a, b) => a - b);
    const cut = searches.filter((s) => s.cutByTime).length;
    const histogram = countBy(searches.map((s) => `d${String(s.depth)}`));
    console.log(
      `  ${higherName} search depth: median ${String(percentile(depths, 0.5))}, p10 ${String(percentile(depths, 0.1))} ` +
        `(target ${String(higher.depth)}), cut by time cap ${String(cut)}/${String(searches.length)} ` +
        `(${((cut / searches.length) * 100).toFixed(0)}%); depths: ${histogram}`,
    );
  }
}

console.log(
  allOk
    ? '\nAll pairings meet the >= 70% target.'
    : '\nSome pairings are below target — consider tuning levels.ts.',
);
