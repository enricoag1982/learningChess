import type { Clock } from '@learn/platform-core';

/** `Clock` over the system clock. */
export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
