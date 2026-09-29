// CI guard: platform-web allows 0 exercise-type / mini-game-mode dispatch literals; each subject pack
// calls the same guard for its own registries.
import { dispatchGuard, listSourceFiles } from './testing/dispatch-guard.ts';

const EXERCISE_TYPES = [
  'collect-stars',
  'capture',
  'select-squares',
  'yes-no',
  'choice',
  'best-move',
  'setup',
  'mate-in-n',
  'number-entry',
];
const MODE_TYPES = ['static', 'series', 'versus'];

dispatchGuard({
  title: 'platform-web: no exercise-type / mini-game-mode dispatch literal',
  root: import.meta.dirname,
  files: listSourceFiles(import.meta.dirname),
  literals: [...EXERCISE_TYPES, ...MODE_TYPES],
});
