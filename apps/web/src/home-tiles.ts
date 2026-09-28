// Chess's Home tiles (`SubjectWeb.homeTiles`) — part of the pack (`chess-pack.ts`), temporary
// home until m8.18 moves it to `subject-chess/src/web`.
import type { HomeTile } from './app/subject.ts';
import { PlayTileIcon } from './home-tiles-icon.tsx';

/** Home's "Play" tile (vs Computer / vs Friend / mini-games): between Practice and My Den, same
 * colours both already use. */
export const HOME_TILES: readonly HomeTile[] = [
  {
    id: 'play',
    order: 3,
    labelKey: 'home.play-tile',
    Icon: PlayTileIcon,
    colors: { bg: '#FBE3D2', fg: '#7A3A10', ledge: '#55290B' },
    route: 'play',
  },
];
