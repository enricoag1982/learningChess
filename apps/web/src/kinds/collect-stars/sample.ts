// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { CollectStarsDef } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';

const EXERCISE: CollectStarsDef = {
  id: 'dev-cs',
  concept: 'rook-move',
  textKey: 'fixtures:dev-cs',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . * .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    R . . . . . . .
  `),
  type: 'collect-stars',
  stars3: 1,
  stars2: 2,
};

export const samples = [{ label: 'collect-stars', def: EXERCISE }];
