import type { StaticMiniGame } from '@chess-kids/core';
import type { MiniGameModeContent } from '../mode-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const staticMode: MiniGameModeContent<StaticMiniGame, typeof schema> = {
  mode: 'static',
  schema,
  compile,
  verify,
};
