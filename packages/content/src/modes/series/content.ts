import type { SeriesMiniGame } from '@chess-kids/core';
import type { MiniGameModeContent } from '../mode-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const seriesMode: MiniGameModeContent<SeriesMiniGame, typeof schema> = {
  mode: 'series',
  schema,
  compile,
  verify,
  exercises: (miniGame) => miniGame.rounds,
};
