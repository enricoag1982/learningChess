// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { BestMoveDef } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';

const EXERCISE: BestMoveDef = {
  id: 'dev-bm',
  concept: 'rook-move',
  textKey: 'fixtures:dev-bm',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    R . . . . . . .
  `),
  type: 'best-move',
  solutions: ['Ra8'],
};

export const samples = [{ label: 'best-move', def: EXERCISE }];
