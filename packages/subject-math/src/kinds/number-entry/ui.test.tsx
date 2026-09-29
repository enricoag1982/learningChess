import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MathState, NumberEntryDef } from '../../core/types.ts';
import { numberEntryKind } from './kind.ts';
import type { NumberEntryPlayAreaProps } from './ui.ts';
import { numberEntryUi } from './ui.ts';

const def: NumberEntryDef = {
  id: 'ne1',
  concept: 'add-within-5',
  textKey: 'lessons:ne1',
  type: 'number-entry',
  problem: { a: 3, op: '+', b: 2 },
  answer: 5,
};

const fresh = numberEntryKind.init(def);

describe('numberEntryUi.toUi', () => {
  it('a wrong answer gives the wrong-answer note and remembers the wrong value', () => {
    expect(
      numberEntryUi.toUi({ kind: 'wrong', value: 6 }, { type: 'submit-number' }, fresh),
    ).toEqual({
      feedback: { kind: 'wrong-answer' },
      hint: null,
      wrongValue: 6,
    });
  });

  it('a solved answer gives the solved note and clears the wrong value', () => {
    expect(numberEntryUi.toUi({ kind: 'solved' }, { type: 'submit-number' }, fresh)).toEqual({
      feedback: { kind: 'solved' },
      hint: null,
      wrongValue: undefined,
    });
  });

  it('a typed digit goes back to the instruction and clears the struck-through value', () => {
    expect(numberEntryUi.toUi({ kind: 'typed' }, { type: 'enter-digit', digit: 5 }, fresh)).toEqual(
      { feedback: { kind: 'instruction' }, wrongValue: undefined },
    );
  });

  it('an ignored action behaves like a typed one', () => {
    expect(numberEntryUi.toUi({ kind: 'ignored' }, { type: 'erase-digit' }, fresh)).toEqual({
      feedback: { kind: 'instruction' },
      wrongValue: undefined,
    });
  });

  it('a hint request clears the wrong value', () => {
    expect(numberEntryUi.clearWrongUi()).toEqual({ wrongValue: undefined });
  });
});

function renderPlayArea(core: Partial<MathState<NumberEntryDef>>, wrongValue?: number) {
  const dispatch = vi.fn<NumberEntryPlayAreaProps['dispatch']>();
  render(
    numberEntryUi.PlayArea({
      def,
      state: {
        core: { ...fresh, ...core },
        hint: null,
        feedback: { kind: 'instruction' },
        wrongValue,
      },
      dispatch,
      showHint: true,
      showCheck: false,
      surface: { worldId: null },
      top: <p>Instruction</p>,
      done: <p>Done</p>,
    }),
  );
  return dispatch;
}

describe('numberEntryUi.PlayArea', () => {
  it('shows the problem card, the entry and the pad, and dispatches the pad keys', () => {
    const dispatch = renderPlayArea({ entry: '4' });
    expect(screen.getByText('3 + 2 = ?')).toBeTruthy();
    expect(screen.getByText('Your answer: 4')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'enter-digit', digit: 9 }],
      [{ type: 'erase-digit' }],
      [{ type: 'submit-number' }],
      [{ type: 'hint' }],
    ]);
  });

  it('draws the dots only once a hint was asked', () => {
    renderPlayArea({});
    expect(document.querySelectorAll('[data-group]')).toHaveLength(0);
    renderPlayArea({ hintLevel: 1 });
    expect(document.querySelectorAll('[data-group]')).toHaveLength(5);
  });

  it('shows a wrong value orange and struck through until the next digit', () => {
    renderPlayArea({ entry: '' }, 7);
    const wrong = screen.getByText('Your answer: 7');
    expect(wrong.className).toContain('line-through');
    expect(wrong.className).toContain('text-today');

    renderPlayArea({ entry: '2' }, undefined);
    expect(screen.getByText('Your answer: 2').className).not.toContain('line-through');
  });

  it('keeps Check disabled while the entry is empty', () => {
    renderPlayArea({ entry: '' });
    expect(screen.getByRole('button', { name: 'Check' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows the result on the card and the done panel once solved', () => {
    renderPlayArea({ entry: '5', solved: true });
    expect(screen.getByText('3 + 2 = 5')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Number pad' })).toBeNull();
  });
});
