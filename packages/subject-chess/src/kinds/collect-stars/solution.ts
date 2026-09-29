import type { CollectStarsDef } from '../../core/exercise/types.ts';
import { illegalTapMove } from '../base.ts';
import { goalSolution } from '../static-move.ts';

export const collectStarsSolution = goalSolution<CollectStarsDef>('collect-stars');

export const collectStarsWrongAction = illegalTapMove;
