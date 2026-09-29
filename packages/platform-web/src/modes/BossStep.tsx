import type { JSX } from 'react';
import { usePack } from '../app/subject.ts';
import { Step as SeriesStep } from './series/Step.tsx';
import type { BossStepProps, MiniGameModeUI } from './mode-ui.ts';

const PLATFORM_MODE_UI: Readonly<Record<string, MiniGameModeUI>> = {
  series: { mode: 'series', Step: SeriesStep },
};

export function BossStep(props: BossStepProps): JSX.Element {
  const pack = usePack();
  const modeUi = PLATFORM_MODE_UI[props.game.mode] ?? pack.modes[props.game.mode];
  if (!modeUi) throw new Error(`BossStep: no mode UI registered for "${props.game.mode}"`);
  return modeUi.Step(props);
}
