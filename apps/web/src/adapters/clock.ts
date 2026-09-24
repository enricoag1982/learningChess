import type { Clock } from '@chess-kids/core';

/** `Clock` over the system clock. */
export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
