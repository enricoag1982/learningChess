import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MathState, NumberEntryDef } from '../../core/types.ts';
import { numberEntryKind } from './kind.ts';
import type { NumberEntryAction } from './kind.ts';
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

function playArea(
  core: Partial<MathState<NumberEntryDef>>,
  wrongValue?: number,
  dispatch = vi.fn<NumberEntryPlayAreaProps['dispatch']>(),
) {
  return numberEntryUi.PlayArea({
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
    top: <p>Instruction</p>,
    done: <p>Done</p>,
  });
}

function renderPlayArea(core: Partial<MathState<NumberEntryDef>>, wrongValue?: number) {
  const dispatch = vi.fn<NumberEntryPlayAreaProps['dispatch']>();
  render(playArea(core, wrongValue, dispatch));
  return dispatch;
}

const entryOutput = (name: string) => screen.getByRole('status', { name });

describe('numberEntryUi.PlayArea', () => {
  it('shows the entry on the problem card and dispatches the pad keys', () => {
    const dispatch = renderPlayArea({ entry: '4' });
    expect(entryOutput('Your answer: 4').textContent).toBe('4');
    expect(screen.getByText('3 + 2 =', { exact: false }).textContent).toBe('3 + 2 = 4');
    expect(screen.queryByText('Your answer:', { exact: false, selector: 'p, div' })).toBeNull();

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

  it('shows ? in place of an empty entry', () => {
    renderPlayArea({ entry: '' });
    expect(entryOutput('Your answer: ?').textContent).toBe('?');
    expect(screen.getByText('3 + 2 =', { exact: false }).textContent).toBe('3 + 2 = ?');
  });

  it('draws the dots only once a hint was asked', () => {
    renderPlayArea({});
    expect(document.querySelectorAll('[data-group]')).toHaveLength(0);
    cleanup();
    renderPlayArea({ hintLevel: 1 });
    expect(document.querySelectorAll('[data-group]')).toHaveLength(5);
  });

  it('strikes only the number of a wrong value, in orange, until the next digit', () => {
    let core = fresh;
    let wrongValue: number | undefined;
    function press(action: NumberEntryAction): void {
      const step = numberEntryKind.act(core, action, null);
      core = step.state;
      const patch = numberEntryUi.toUi(step.outcome, action, core);
      if ('wrongValue' in patch) wrongValue = patch.wrongValue;
    }

    press({ type: 'enter-digit', digit: 6 });
    press({ type: 'submit-number' });
    const { rerender } = render(playArea(core, wrongValue));
    const wrong = entryOutput('Your answer: 6');
    expect(wrong.className).toContain('line-through');
    expect(wrong.className).toContain('text-today');
    expect(wrong.closest('p')?.className).not.toContain('line-through');

    press({ type: 'enter-digit', digit: 5 });
    rerender(playArea(core, wrongValue));
    expect(entryOutput('Your answer: 5').className).not.toContain('line-through');
  });

  it('keeps Check disabled while the entry is empty', () => {
    renderPlayArea({ entry: '' });
    expect(screen.getByRole('button', { name: 'Check' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows the result on the card and the done panel once solved', () => {
    renderPlayArea({ entry: '5', solved: true });
    expect(screen.getByText('3 + 2 = 5')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Number pad' })).toBeNull();
  });
});
