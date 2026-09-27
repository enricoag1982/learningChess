import type { Position } from '../../../chess/types.ts';
import type { CaptureDef, CollectStarsDef } from '../../types.ts';

/** Shape shared by anything that reduces to a static-opponent `capture` / `collect-stars` goal. */
export interface StaticGoalSource {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
  readonly position: Position;
  /** Win condition; defaults to `capture-all` (every mini-game before M2.3 was capture-only). */
  readonly goal?: 'capture-all' | 'collect-stars';
  /** Move count within which the goal is met at "3-star" pace; also used as the solver's stars2. */
  readonly par: number;
}

/** Builds the `capture` / `collect-stars` exercise a static-opponent goal reduces to (solver input). */
export function staticGoalExercise(source: StaticGoalSource): CaptureDef | CollectStarsDef {
  const shared = {
    id: source.id,
    concept: source.concept,
    textKey: source.textKey,
    position: source.position,
    stars3: source.par,
    stars2: source.par,
  } as const;
  if ((source.goal ?? 'capture-all') === 'collect-stars') {
    return { ...shared, type: 'collect-stars' };
  }
  return { ...shared, type: 'capture' };
}
