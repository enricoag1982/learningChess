// The mini-game-mode UI registry — the only place mode dispatch happens for the boss UI (`BossStep`,
// never a local `if`/`switch`).
import type { JSX } from 'react';
import type { ModeType } from '@chess-kids/core/chess';
import { Step as SeriesStep } from './series/Step.tsx';
import { Step as StaticStep } from './static/Step.tsx';
import { Step as VersusStep } from './versus/Step.tsx';
import type { BossStepProps, MiniGameModeUI } from './mode-ui.ts';

/** Every mini-game mode's UI, by `mode`. */
export const MINI_GAME_MODE_UI = {
  static: { mode: 'static', Step: StaticStep },
  series: { mode: 'series', Step: SeriesStep },
  versus: { mode: 'versus', Step: VersusStep },
} as const satisfies { readonly [M in ModeType]: MiniGameModeUI<M> };

/** The lesson's boss mini-game: renders `game.mode`'s own `Step` (`MINI_GAME_MODE_UI`). */
export function BossStep(props: BossStepProps<ModeType>): JSX.Element {
  const modeUi = MINI_GAME_MODE_UI[props.game.mode] as MiniGameModeUI<ModeType>;
  return modeUi.Step(props);
}
