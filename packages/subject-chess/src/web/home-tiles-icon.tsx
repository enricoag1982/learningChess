import type { JSX } from 'react';
import { Svg } from '@learn/platform-web/ui/ds/icons.tsx';

/** Home's "Play" tile icon, in its own file so `home-tiles.ts` stays JSX-free (a data module for Fast Refresh). */
export function PlayTileIcon(): JSX.Element {
  return (
    <Svg size={32} stroke="#B8561A">
      <rect x={3} y={3} width={18} height={18} rx={3} />
      <path d="M3 12h18M12 3v18" />
    </Svg>
  );
}
