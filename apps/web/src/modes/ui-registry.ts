// The mini-game-mode UI registry — the only place mode dispatch happens for the boss UI (`BossStep`,
// never a local `if`/`switch`).
import type { JSX } from 'react';
import type { MiniGame, ModeType } from '@chess-kids/core/chess';
import { Step as SeriesStep } from './series/Step.tsx';
import { Step as StaticStep } from './static/Step.tsx';
import { Step as VersusStep } from './versus/Step.tsx';
import type { BossStepProps, MiniGameModeUI } from './mode-ui.ts';

/** `M`'s own mini-game type — `kinds/e2e-registry.ts`'s sibling for the mode e2e drivers. */
export type GameOf<M extends ModeType> = Extract<MiniGame, { readonly mode: M }>;

/** Every mode's UI, by `mode` — widened for lookup by an unnarrowed `game.mode` (a base caller). */
const MINI_GAME_MODE_UI: Readonly<Record<string, MiniGameModeUI>> = {
  static: { mode: 'static', Step: StaticStep },
  series: { mode: 'series', Step: SeriesStep },
  versus: { mode: 'versus', Step: VersusStep },
} satisfies { readonly [M in ModeType]: MiniGameModeUI<GameOf<M>> };

/** The lesson's boss mini-game: renders `game.mode`'s own `Step` (`MINI_GAME_MODE_UI`). */
export function BossStep(props: BossStepProps): JSX.Element {
  const modeUi = MINI_GAME_MODE_UI[props.game.mode];
  if (!modeUi) throw new Error(`BossStep: no mode UI registered for "${props.game.mode}"`);
  return modeUi.Step(props);
}
