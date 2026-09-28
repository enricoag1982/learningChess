import type { JSX, ReactNode } from 'react';
import { usePack } from '../app/subject.ts';
import { GameLayout } from '../ui/lesson/GameLayout.tsx';
import type { PlayAreaProps } from './kind-ui.ts';

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

export type ExercisePlayProps = PlayAreaProps;

/** Renders `def`'s own kind's `PlayArea` — the one place exercise-type dispatch happens for the
 * exercise UI (the active pack's `kinds`, never a local `if`/`switch`). */
export function ExercisePlay(props: ExercisePlayProps): JSX.Element {
  const pack = usePack();
  const kindUi = pack.kinds[props.def.type];
  if (!kindUi) {
    throw new Error(`ExercisePlay: no kind UI registered for type "${props.def.type}"`);
  }
  return kindUi.PlayArea(props);
}
