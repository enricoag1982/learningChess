import type { JSX } from 'react';
import type { ActionOf, DefOf, ExerciseStateOf } from '../../chess.ts';
import type { PlayAreaProps } from '@learn/platform-web/kinds/kind-ui.ts';
import type { MoveExtra } from '../../web/kinds/move-ui.ts';
import { MoveCountedPlayArea } from '../../web/kinds/MoveCountedPlayArea.tsx';

export function PlayArea(
  props: PlayAreaProps<
    DefOf<'collect-stars'>,
    ExerciseStateOf<DefOf<'collect-stars'>>,
    ActionOf<'collect-stars'>,
    MoveExtra
  >,
): JSX.Element {
  return <MoveCountedPlayArea {...props} />;
}
