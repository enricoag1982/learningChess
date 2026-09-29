// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { Position } from '../../core/chess/types.ts';
import type { SetupDef } from '../../core/exercise/types.ts';
import { parseDiagram } from '../../core/chess/diagram.ts';

const TARGET: Position = parseDiagram(`
  . . . . . . . r
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  R . . . . . . .
`);
const START: Position = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
};
const EXERCISE: SetupDef = {
  id: 'dev-su',
  concept: 'board-setup',
  textKey: 'fixtures:dev-su',
  position: START,
  type: 'setup',
  target: TARGET,
};

export const samples = [{ label: 'setup', def: EXERCISE }];
