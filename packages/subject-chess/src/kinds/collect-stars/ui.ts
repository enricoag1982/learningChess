import type { CollectStarsDef } from '../../core/exercise/types.ts';
import { moveCountedUi } from '../../web/kinds/move-counted-ui.ts';

export const collectStarsUi = moveCountedUi<CollectStarsDef>('collect-stars');
