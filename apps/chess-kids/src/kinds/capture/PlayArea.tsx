import type { JSX } from 'react';
import type { ActionOf, DefOf, ExerciseStateOf } from '@learn/subject-chess';
import type { PlayAreaProps } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { MoveCountedPlayArea } from '../MoveCountedPlayArea.tsx';

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
