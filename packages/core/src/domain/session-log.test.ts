import { describe, expect, it } from 'vitest';

import { addMinutes, newSessionLog } from './session-log.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('addMinutes', () => {
  it('starts a fresh row when there is none yet', () => {
    const log = addMinutes(undefined, 'l1', 'p1', '2026-01-05', 12, NOW);
    expect(log).toEqual(newSessionLog('l1', 'p1', '2026-01-05', 12, NOW));
  });

  it('sums minutes into an existing same-day row', () => {
    const first = addMinutes(undefined, 'l1', 'p1', '2026-01-05', 12, NOW);
    const later = new Date('2026-01-05T12:00:00.000Z');
    const second = addMinutes(first, 'l1', 'p1', '2026-01-05', 8, later);
    expect(second.minutes).toBe(20);
    expect(second.id).toBe('l1');
    expect(second.updatedAt).toBe(later.toISOString());
  });
});
