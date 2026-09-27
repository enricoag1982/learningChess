// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { ChoiceDef } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';

const EXERCISE: ChoiceDef = {
  id: 'dev-ch',
  concept: 'exchange',
  textKey: 'fixtures:dev-ch',
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
  type: 'choice',
  showBoard: false,
  options: [
    { id: 'queen', piece: { color: 'w', type: 'q' } },
    { id: 'rook', piece: { color: 'w', type: 'r' } },
    { id: 'bishop', piece: { color: 'w', type: 'b' } },
  ],
  answer: 'queen',
};

export const samples = [{ label: 'choice', def: EXERCISE }];
