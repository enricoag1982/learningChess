import type { CaptureDef } from '../../core/exercise/types.ts';
import { illegalTapMove } from '../base.ts';
import { goalSolution } from '../static-move.ts';

export const captureSolution = goalSolution<CaptureDef>('capture');

export const captureWrongAction = illegalTapMove;
