import type { ExerciseDef } from '../core/exercise/types.ts';
import type { GameState } from './static/def.ts';
import type { SeriesGameState } from '@learn/platform-core/domain/exercise/modes/series/def';
import type { VersusState } from './versus/def.ts';

export type MiniGameState = GameState | SeriesGameState<ExerciseDef> | VersusState;
export type ModeType = MiniGameState['mode'];
