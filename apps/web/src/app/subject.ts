import { createContext, useContext } from 'react';
import type { SubjectCore } from '@chess-kids/core';
import type { AnyExerciseKindUI } from '../kinds/kind-ui.ts';

/** A subject's own runtime services, augmented by module declaration (chess: `{ botPlayer }`). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per subject
export interface SubjectServices {}

/** A board/story/demo surface's own lesson world, for the subject's piece look (chess: the animal
 * badge, off in World 5 and for a review task, `worldId: null`). */
export interface SurfaceContext {
  readonly worldId: string | null;
}

/** One subject's whole web behaviour behind the platform's uniform interface (docs/refactor-v4.md
 * §11). Grows a field per seam commit; a subject omits what it has no use for. */
export interface SubjectWeb {
  readonly core: SubjectCore;
  /** Built once at composition-root time (`app/services.ts`), never per render — a subject's own
   * services (chess: a worker-backed bot player) live on the result, not recreated on each call. */
  createServices(): SubjectServices;
  /** Every exercise kind's UI, by `type` — `ExercisePlay`'s one dispatch point. */
  readonly kinds: Readonly<Record<string, AnyExerciseKindUI>>;
}

const PackContext = createContext<SubjectWeb | null>(null);

export const PackProvider = PackContext.Provider;

/** The active subject's whole web pack; must be used under `PackProvider` (`App.tsx`). */
export function usePack(): SubjectWeb {
  const pack = useContext(PackContext);
  if (!pack) {
    throw new Error('usePack must be used within a PackProvider');
  }
  return pack;
}
