import type { NumberEntryDef } from '../../core/types.ts';
import { DIGITS } from './kind.ts';
import type { Digit, NumberEntryAction } from './kind.ts';

function digitOf(char: string): Digit {
  const digit = DIGITS.find((candidate) => String(candidate) === char);
  if (digit === undefined) {
    throw new Error(`number-entry: "${char}" is not a digit`);
  }
  return digit;
}

/** Types `value` digit by digit, then checks it. */
function typeAndCheck(value: number): readonly NumberEntryAction[] {
  return [
    ...Array.from(String(value), (char): NumberEntryAction => ({
      type: 'enter-digit',
      digit: digitOf(char),
    })),
    { type: 'submit-number' },
  ];
}

export function numberEntrySolution(def: NumberEntryDef): readonly NumberEntryAction[] {
  return typeAndCheck(def.answer);
}

/** The next number: exactly 1 error, the entry cleared, still answerable. */
export function numberEntryWrongAction(def: NumberEntryDef): readonly NumberEntryAction[] {
  return typeAndCheck(def.answer + 1);
}
