// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { ChoiceDef } from '../../core/exercise/types.ts';
import { parseDiagram } from '../../core/chess/diagram.ts';

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
