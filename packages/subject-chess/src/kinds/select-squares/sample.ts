// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { SelectSquaresDef } from '../../chess.ts';
import { parseDiagram } from '../../chess.ts';

// White king g1, in check from the rook on g8; f2/h2 are the kid's own pawns, so f1 and h1 are the
// only legal king moves — the exact squares `derive: check-escapes` should select.
const CHECK_ESCAPES: SelectSquaresDef = {
  id: 'dev-check-escapes',
  concept: 'check-escape',
  textKey: 'fixtures:dev-check-escapes',
  position: parseDiagram(`
    k . . . . . r .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . P . P
    . . . . . . K .
  `),
  type: 'select-squares',
  answer: { derive: 'check-escapes' },
};

// White pawn on e4 attacks d5 and f5 diagonally only, own piece (d5) or enemy (f5) alike — never
// e5, straight ahead of it.
const ATTACKED_BY: SelectSquaresDef = {
  id: 'dev-attacked-by',
  concept: 'attack',
  textKey: 'fixtures:dev-attacked-by',
  position: parseDiagram(`
    . . . . . . k .
    . . . . . . . .
    . . . . . . . .
    . . . P . p . .
    . . . . P . . .
    . . . . . . . .
    . . . . . . . .
    . . . . K . . .
  `),
  type: 'select-squares',
  answer: { derive: 'attacked-by', from: 'e4' },
};

export const samples = [
  { label: 'check-escapes', def: CHECK_ESCAPES },
  { label: 'attacked-by', def: ATTACKED_BY },
];
