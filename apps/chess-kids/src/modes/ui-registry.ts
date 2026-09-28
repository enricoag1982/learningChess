// The chess mini-game-mode UI registry (`SubjectWeb.modes`): the only place chess dispatches on a
// mode for the boss UI; the platform's own `series` mode is in `BossStep`.
import type { MiniGame, ModeType } from '@learn/subject-chess';
import { Step as StaticStep } from './static/Step.tsx';
import { Step as VersusStep } from './versus/Step.tsx';
import type { MiniGameModeUI } from '@learn/platform-web/modes/mode-ui.ts';

/** `M`'s own mini-game type — `kinds/e2e-registry.ts`'s sibling for the mode e2e drivers. */
export type GameOf<M extends ModeType> = Extract<MiniGame, { readonly mode: M }>;

/** Every chess mode's UI, by `mode` — widened for lookup by an unnarrowed `game.mode`. */
export const MINI_GAME_MODE_UI: Readonly<Record<string, MiniGameModeUI>> = {
  static: { mode: 'static', Step: StaticStep },
  versus: { mode: 'versus', Step: VersusStep },
} satisfies { readonly [M in Exclude<ModeType, 'series'>]: MiniGameModeUI<GameOf<M>> };
