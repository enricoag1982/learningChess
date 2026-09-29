import { errorHintStars } from '@learn/platform-core/domain/exercise/stars';
import { initMathState } from '../../core/state.ts';
import type { MathState, NumberEntryDef, NumberEntryHint } from '../../core/types.ts';
import type { MathKind } from '../../core/types.ts';

export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const DIGITS: readonly Digit[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const MAX_DIGITS = 2;

export type NumberEntryAction =
  | { readonly type: 'enter-digit'; readonly digit: Digit }
  | { readonly type: 'erase-digit' }
  | { readonly type: 'submit-number' };

export type NumberEntryOutcome =
  | { readonly kind: 'typed' | 'solved' | 'ignored' }
  | { readonly kind: 'wrong'; readonly value: number };

type State = MathState<NumberEntryDef>;

const IGNORED: NumberEntryOutcome = { kind: 'ignored' };

function enterDigit(state: State, digit: Digit): { state: State; outcome: NumberEntryOutcome } {
  if (state.solved || state.entry.length >= MAX_DIGITS) {
    return { state, outcome: IGNORED };
  }
  const entry = state.entry === '0' ? String(digit) : `${state.entry}${String(digit)}`;
  return { state: { ...state, entry }, outcome: { kind: 'typed' } };
}

function submitNumber(state: State): { state: State; outcome: NumberEntryOutcome } {
  if (state.solved || state.entry === '') {
    return { state, outcome: IGNORED };
  }
  const value = Number(state.entry);
  if (value === state.def.answer) {
    return {
      state: { ...state, solved: true, moves: state.moves + 1 },
      outcome: { kind: 'solved' },
    };
  }
  return {
    state: { ...state, errors: state.errors + 1, moves: state.moves + 1, entry: '' },
    outcome: { kind: 'wrong', value },
  };
}

export const numberEntryKind: MathKind<NumberEntryDef, NumberEntryAction, NumberEntryOutcome> = {
  type: 'number-entry',
  input: 'answer',

  init: initMathState,

  /** Every action is ignored once solved, so a late tap never rescores the exercise. */
  act(state, action) {
    switch (action.type) {
      case 'enter-digit':
        return enterDigit(state, action.digit);
      case 'erase-digit':
        if (state.solved || state.entry === '') {
          return { state, outcome: IGNORED };
        }
        return { state: { ...state, entry: state.entry.slice(0, -1) }, outcome: { kind: 'typed' } };
      case 'submit-number':
        return submitNumber(state);
    }
  },

  /** 1: dots on the card; 2: adds the problem for "count on / back"; 3: types the answer in. */
  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    if (level === 3) {
      return {
        state: { ...bumped, entry: String(state.def.answer) },
        hint: { kind: 'number-entry', level, reveal: true },
      };
    }
    const hint: NumberEntryHint = {
      kind: 'number-entry',
      level,
      reveal: false,
      ...(level === 2 && state.def.problem !== undefined ? { problem: state.def.problem } : {}),
    };
    return { state: bumped, hint };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};
