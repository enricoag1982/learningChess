// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { MateInNDef } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';

// 1.Ne7+ Kh8 2.Qa8# — mate in 2, kid = White; Kf8 is also legal but the line scripts Kh8, so the
// reply's reveal delay and narration show up here too.
const EXERCISE: MateInNDef = {
  id: 'dev-mate2',
  concept: 'mate-in-2',
  textKey: 'fixtures:dev-mate2',
  position: parseDiagram(`
    . . . . . . k .
    . . . . . p p p
    . . N . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    Q K . . . . . .
  `),
  type: 'mate-in-n',
  n: 2,
  line: ['Ne7+', 'Kh8', 'Qa8#'],
};

export const samples = [{ label: 'mate-in-2', def: EXERCISE }];
