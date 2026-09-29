import type { CaptureDef } from '../../core/exercise/types.ts';
import { moveCountedUi } from '../../web/kinds/move-counted-ui.ts';

export const captureUi = moveCountedUi<CaptureDef>('capture');
