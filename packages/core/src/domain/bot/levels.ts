/** One difficulty profile for the computer opponent (`docs/computer-opponent.md` §3). */
export interface BotLevel {
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly name: 'mouse' | 'rabbit' | 'fox' | 'wolf' | 'bear';
  /** Probability of picking any legal move at random. */
  readonly random: number;
  /** Probability of picking the best move by 1-ply static evaluation (no reply). */
  readonly shallow: number;
  /** Alpha-beta search depth in plies; unused (`searchShare` is 0) at Mouse. */
  readonly depth: number;
  /** Probability of picking a move from the alpha-beta search. */
  readonly searchShare: number;
  /** Plays a forced mate-in-1 (or immediate variant win) instead of rolling a mode. */
  readonly alwaysMateInOne: boolean;
  /** Own moves during which the queen stays home, unless attacked or it is the only legal move. */
  readonly queenHomeMoves: number;
}

/** Mouse → Bear, values from `docs/computer-opponent.md` §3. */
export const BOT_LEVELS: readonly BotLevel[] = [
  {
    level: 1,
    name: 'mouse',
    random: 0.5,
    shallow: 0.5,
    depth: 0,
    searchShare: 0,
    alwaysMateInOne: false,
    queenHomeMoves: 5,
  },
  {
    level: 2,
    name: 'rabbit',
    random: 0.25,
    shallow: 0.5,
    depth: 2,
    searchShare: 0.25,
    alwaysMateInOne: true,
    queenHomeMoves: 5,
  },
  {
    level: 3,
    name: 'fox',
    random: 0.1,
    shallow: 0.2,
    depth: 2,
    searchShare: 0.7,
    alwaysMateInOne: true,
    queenHomeMoves: 5,
  },
  {
    level: 4,
    name: 'wolf',
    random: 0.05,
    shallow: 0.05,
    depth: 3,
    searchShare: 0.9,
    alwaysMateInOne: true,
    queenHomeMoves: 0,
  },
  {
    level: 5,
    name: 'bear',
    random: 0,
    shallow: 0,
    depth: 4,
    searchShare: 1,
    alwaysMateInOne: true,
    queenHomeMoves: 0,
  },
];
