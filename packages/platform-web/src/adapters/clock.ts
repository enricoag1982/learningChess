import type { Clock } from '@learn/platform-core';

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
