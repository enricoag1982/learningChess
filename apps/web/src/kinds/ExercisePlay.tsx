import type { JSX, ReactNode } from 'react';
import type { ExerciseType } from '@chess-kids/core';
import { GameLayout } from '../ui/lesson/GameLayout.tsx';
import type { PlayAreaProps } from './kind-ui.ts';
import { kindUiOf } from './ui-registry.ts';

export interface ExerciseFrameProps {
  readonly board: ReactNode | null;
  readonly panel: ReactNode;
  readonly belowBoard?: ReactNode;
}

/** Board+panel split (`GameLayout`), or — an exercise type with its board hidden (`choice`) — the
 * panel's full width instead of leaving an empty board-shaped gap. */
export function ExerciseFrame({ board, panel, belowBoard }: ExerciseFrameProps): JSX.Element {
  if (board === null) {
    return <div className="flex min-h-0 flex-1 flex-col gap-4">{panel}</div>;
  }
  return <GameLayout board={board} panel={panel} belowBoard={belowBoard} />;
}

export type ExercisePlayProps = PlayAreaProps<ExerciseType>;

/** Renders `def`'s own kind's `PlayArea` — the one place exercise-type dispatch happens for the
 * exercise UI (`ui-registry.ts`'s `kindUiOf`, never a local `if`/`switch`). */
export function ExercisePlay(props: ExercisePlayProps): JSX.Element {
  return kindUiOf(props.def).PlayArea(props);
}
