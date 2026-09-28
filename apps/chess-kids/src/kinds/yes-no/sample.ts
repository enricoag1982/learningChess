// Dev-only playground fixture (`dev/ExercisePlayground.tsx`, loaded via `import.meta.glob`) — never
// imported by app code (see eslint.config.js).
import type { YesNoDef } from '@learn/subject-chess';
import { parseDiagram } from '@learn/subject-chess';

const EXERCISE: YesNoDef = {
  id: 'dev-yn',
  concept: 'hanging-piece',
  textKey: 'fixtures:dev-yn',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . p . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
  `),
  type: 'yes-no',
  answer: true,
  focus: 'e4',
};

export const samples = [{ label: 'yes-no', def: EXERCISE }];
