import type { VersusMiniGame } from '../../core/chess/lesson.ts';
import type { MiniGameModeContent } from '@learn/platform-content/modes/mode-content';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const versusMode: MiniGameModeContent<VersusMiniGame, typeof schema> = {
  mode: 'versus',
  schema,
  compile,
  verify,
};
