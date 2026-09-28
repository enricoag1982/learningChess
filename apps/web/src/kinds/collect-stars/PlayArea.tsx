import type { JSX } from 'react';
import type { ActionOf, DefOf, ExerciseStateOf } from '@chess-kids/core/chess';
import type { PlayAreaProps } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { MoveCountedPlayArea } from '../MoveCountedPlayArea.tsx';

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
