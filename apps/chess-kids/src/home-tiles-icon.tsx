import type { JSX } from 'react';
import { Svg } from './ui/ds/icons.tsx';

/** Home's "Play" tile icon (vs Computer / vs Friend / mini-games) — its own file: `home-tiles.ts`
 * (plain data, `SubjectWeb.homeTiles`) stays JSX-free so Fast Refresh treats it as a data module. */
export function PlayTileIcon(): JSX.Element {
  return (
    <Svg size={32} stroke="#B8561A">
      <rect x={3} y={3} width={18} height={18} rx={3} />
      <path d="M3 12h18M12 3v18" />
    </Svg>
  );
}
