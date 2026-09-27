import type { SelectSquaresDef, Square } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { schema } from './schema.ts';

/** Value guaranteed non-`undefined` by a zod schema that already validated successfully. */
function assertValidated<T>(value: T | undefined, context: string): T {
  if (value === undefined) {
    throw new Error(`lesson-load: ${context}: expected a value already validated by the schema`);
  }
  return value;
}

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): SelectSquaresDef {
  let answer: SelectSquaresDef['answer'];
  if (raw.answer !== undefined) {
    answer = { squares: raw.answer as readonly Square[] };
  } else if (raw.derive === 'check-escapes') {
    answer = { derive: 'check-escapes' };
  } else if (raw.derive === 'attacked-by') {
    answer = {
      derive: 'attacked-by',
      from: assertValidated(raw.from, `${ctx.where}.from`) as Square,
    };
  } else {
    answer = {
      derive: 'legal-moves',
      from: assertValidated(raw.from, `${ctx.where}.from`) as Square,
    };
  }
  return ctx.build({ type: 'select-squares', answer });
}
