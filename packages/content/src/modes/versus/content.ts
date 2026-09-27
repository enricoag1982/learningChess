import type { VersusMiniGame } from '@chess-kids/core';
import type { MiniGameModeContent } from '../mode-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const versusMode: MiniGameModeContent<VersusMiniGame, typeof schema> = {
  mode: 'versus',
  schema,
  compile,
  verify,
};
