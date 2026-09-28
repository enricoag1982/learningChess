import type { JSX } from 'react';
import type { ActionOf, DefOf, ExerciseStateOf } from '../../chess.ts';
import type { PlayAreaProps } from '@learn/platform-web/kinds/kind-ui.ts';
import type { MoveExtra } from '../../web/kinds/move-ui.ts';
import { MoveCountedPlayArea } from '../../web/kinds/MoveCountedPlayArea.tsx';

export function PlayArea(
  props: PlayAreaProps<
    DefOf<'capture'>,
    ExerciseStateOf<DefOf<'capture'>>,
    ActionOf<'capture'>,
    MoveExtra
  >,
): JSX.Element {
  return <MoveCountedPlayArea {...props} />;
}
