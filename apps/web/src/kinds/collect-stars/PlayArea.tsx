import type { JSX } from 'react';
import type { PlayAreaProps } from '../kind-ui.ts';
import { MoveCountedPlayArea } from '../MoveCountedPlayArea.tsx';

export function PlayArea(props: PlayAreaProps<'collect-stars'>): JSX.Element {
  return <MoveCountedPlayArea {...props} />;
}
