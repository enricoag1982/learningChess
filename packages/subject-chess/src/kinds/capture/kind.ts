import type { CaptureDef } from '../../core/exercise/types.ts';
import { moveCountedKind } from '../static-move.ts';

export const captureKind = moveCountedKind<CaptureDef>('capture');
