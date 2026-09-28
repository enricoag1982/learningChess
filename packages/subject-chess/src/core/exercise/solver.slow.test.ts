import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import { createVariantRules } from '../variant/rules.ts';
import { solve } from './solver.ts';

// Wall-clock budget: runs in the `slow` CI job, alone on its runner.
const rules = createVariantRules(chessJsRules);

describe('solve (timing)', () => {
  it('solves a 5-star rook position in under 200ms', () => {
    const position = parseDiagram(
      [
        '* . . . . . . *',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . * R . . .',
        '. . . . . . . .',
        '. . . . * . . .',
        '. . . . . . . .',
        '* . . . . . . .',
      ].join('\n'),
    );

    const start = performance.now();
    const line = solve(position, rules, 'collect-stars');
    const elapsed = performance.now() - start;

    expect(line).not.toBeNull();
    expect(elapsed).toBeLessThan(200);
  });
});
