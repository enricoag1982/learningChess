// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { CaptureDef } from '@learn/subject-chess';
import { parseDiagram } from '@learn/subject-chess';

const EXERCISE: CaptureDef = {
  id: 'dev-cap',
  concept: 'rook-move',
  textKey: 'fixtures:dev-cap',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    R . . . . . . p
  `),
  type: 'capture',
  stars3: 1,
  stars2: 2,
};

export const samples = [{ label: 'capture', def: EXERCISE }];
