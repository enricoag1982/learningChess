import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChoiceOptions } from '@learn/platform-web/kinds/choice/ChoiceOptions.tsx';
import type { MathChoiceDef, MathChoiceOption, MathState } from '../../core/types.ts';
import { mathChoiceKind } from './kind.ts';
import { MATH_CHOICE_LOOK } from './look.tsx';
import { choiceUi } from './ui.ts';

const OPTIONS: readonly MathChoiceOption[] = [
  { id: 'a', value: 3 },
  { id: 'b', value: 4 },
  { id: 'c', value: 5 },
];

const def: MathChoiceDef = {
  id: 'ch1',
  concept: 'add-within-5',
  textKey: 'lessons:ch1',
  type: 'choice',
  problem: { a: 2, op: '+', b: 2 },
  options: OPTIONS,
  answer: 'b',
};

describe('math choice look', () => {
  it('names each numeral option by its value', () => {
    render(
      <ChoiceOptions
        options={OPTIONS}
        wrongOptionIds={[]}
        onPick={vi.fn()}
        look={MATH_CHOICE_LOOK}
      />,
    );
    for (const value of ['3', '4', '5']) {
      const button = screen.getByRole('button', { name: value });
      expect(button.getAttribute('aria-label')).toBe(value);
      expect(button.textContent).toBe(value);
    }
  });

  it('disables a wrong option in orange and reports a pick by id', () => {
    const onPick = vi.fn();
    render(
      <ChoiceOptions
        options={OPTIONS}
        wrongOptionIds={['a']}
        onPick={onPick}
        look={MATH_CHOICE_LOOK}
      />,
    );
    const wrong = screen.getByRole('button', { name: '3' });
    expect(wrong.hasAttribute('disabled')).toBe(true);
    expect(wrong.className).toContain('border-today');

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onPick).toHaveBeenCalledWith('b');
  });
});

function renderPlayArea(core: Partial<MathState<MathChoiceDef>>, problem = def.problem) {
  const dispatch = vi.fn();
  render(
    choiceUi.PlayArea({
      def: { ...def, problem },
      state: {
        core: { ...mathChoiceKind.init(def), ...core },
        hint: null,
        feedback: { kind: 'instruction' },
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

describe('math choiceUi', () => {
  it('shows the problem card and dispatches a picked option', () => {
    const dispatch = renderPlayArea({});
    expect(screen.getByText('2 + 2 = ?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'answer-choice', optionId: 'c' });
  });

  it('draws the dots once a hint was asked, and the result once solved', () => {
    renderPlayArea({ hintLevel: 1 });
    expect(document.querySelectorAll('[data-group]')).toHaveLength(4);
    renderPlayArea({ solved: true });
    expect(screen.getByText('2 + 2 = 4')).toBeTruthy();
  });

  it('gives the options the full width when there is no problem', () => {
    renderPlayArea({}, undefined);
    expect(document.querySelector('[data-group]')).toBeNull();
    expect(screen.getByRole('button', { name: '3' })).toBeTruthy();
  });

  it('a wrong pick gives the wrong-answer note, anything else the solved one', () => {
    const state = mathChoiceKind.init(def);
    const pick = { type: 'answer-choice', optionId: 'a' } as const;
    expect(choiceUi.toUi({ kind: 'wrong' }, pick, state)).toEqual({
      feedback: { kind: 'wrong-answer' },
      hint: null,
    });
    expect(choiceUi.toUi({ kind: 'solved' }, pick, state)).toEqual({
      feedback: { kind: 'solved' },
      hint: null,
    });
  });
});
