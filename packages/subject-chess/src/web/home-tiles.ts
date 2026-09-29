// Chess's Home tiles (`SubjectWeb.homeTiles`), part of the chess pack (`chess-pack.ts`).
import type { HomeTile } from '@learn/platform-web/app/subject.ts';
import { PlayTileIcon } from './home-tiles-icon.tsx';

/** Home's "Play" tile: between Practice and My Den, in the colours both already use. */
export const HOME_TILES: readonly HomeTile[] = [
  {
    id: 'play',
    order: 3,
    labelKey: 'home.play-tile',
    Icon: PlayTileIcon,
    colors: { bg: '#FBE3D2', fg: '#7A3A10', ledge: '#55290B' },
    route: { name: 'play' },
  },
];
