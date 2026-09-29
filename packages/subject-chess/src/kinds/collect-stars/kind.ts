import type { CollectStarsDef } from '../../core/exercise/types.ts';
import { moveCountedKind } from '../static-move.ts';

export const collectStarsKind = moveCountedKind<CollectStarsDef>('collect-stars');
