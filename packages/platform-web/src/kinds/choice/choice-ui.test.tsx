import { describe, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { ExerciseStateBase } from '@learn/platform-core';
import type {
  AnswerChoiceAction,
  ChoiceDefBase,
  ChoiceOptionBase,
  ChoiceState,
} from '@learn/platform-core/domain/exercise/kinds/choice/def';
import type { PlayAreaProps } from '../kind-ui.ts';
import { ChoiceOptions } from './ChoiceOptions.tsx';
import type { ChoiceLook } from './ChoiceOptions.tsx';
import { createChoiceUi } from './create-choice-ui.tsx';

interface NumberOption extends ChoiceOptionBase {
  readonly value?: number;
}
type NumberDef = ChoiceDefBase<NumberOption>;
type State = ExerciseStateBase<NumberDef> & ChoiceState<NumberDef>;
interface Extra {
  readonly wrongCount: number;
}

const i18n = createInstance();
await i18n.init({
  lng: 'en',
  resources: { en: { translation: { 'opt.four': 'Four', 'exercise.hint': 'Hint' } } },
});

const OPTIONS: readonly NumberOption[] = [
  { id: 'a', value: 3 },
  { id: 'b', value: 4 },
  { id: 'c', textKey: 'opt.four' },
];

const LOOK: ChoiceLook<NumberOption> = {
  visual: ({ value }) => value !== undefined && <b data-testid="numeral">{value}</b>,
  label: ({ value }, text) => `${text('opt.four')} ${String(value)}`,
};

function withI18n(ui: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('ChoiceOptions', () => {
  it('draws each option as a tall tile with its visual, and names a text-less one by the look', () => {
    render(
      withI18n(
        <ChoiceOptions options={OPTIONS} wrongOptionIds={[]} onPick={vi.fn()} look={LOOK} />,
      ),
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button.className).toContain('min-h-24');
    expect(screen.getAllByTestId('numeral').map((node) => node.textContent)).toEqual(['3', '4']);
    expect(screen.getByRole('button', { name: 'Four 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Four' }).hasAttribute('aria-label')).toBe(false);
  });

  it('disables a wrong option in orange and reports a pick by id', () => {
    const onPick = vi.fn();
    render(
      withI18n(
        <ChoiceOptions options={OPTIONS} wrongOptionIds={['a']} onPick={onPick} look={LOOK} />,
      ),
    );
    const wrong = screen.getByRole('button', { name: 'Four 3' });
    expect(wrong.hasAttribute('disabled')).toBe(true);
    expect(wrong.className).toContain('border-today');

    screen.getByRole('button', { name: 'Four 4' }).click();
    expect(onPick).toHaveBeenCalledWith('b');
  });
});

const def: NumberDef = {
  id: 'n1',
  concept: 'count',
  textKey: 'n1',
  type: 'choice',
  options: OPTIONS,
  answer: 'b',
};

const ui = createChoiceUi<NumberDef, State, Extra>({
  initUi: () => ({ wrongCount: 0 }),
  clearWrongUi: () => ({ wrongCount: 0 }),
  stimulus: ({ state }) => (state.core.errors > 5 ? null : <p>problem card</p>),
  look: LOOK,
});

function props(
  core: Partial<State>,
  dispatch = vi.fn(),
): PlayAreaProps<NumberDef, State, AnswerChoiceAction, Extra> {
  return {
    def,
    state: {
      core: { def, moves: 0, solved: false, errors: 0, hintLevel: 0, ...core },
      hint: null,
      feedback: { kind: 'instruction' },
      wrongCount: 0,
    },
    dispatch,
    showHint: true,
    showCheck: true,
    surface: { worldId: null },
    top: <p>instruction</p>,
    done: <p>well done</p>,
  };
}

describe('createChoiceUi', () => {
  it('maps a wrong answer to the wrong-answer note and clears the kind extras', () => {
    const patch = ui.toUi(
      { kind: 'wrong' },
      { type: 'answer-choice', optionId: 'a' },
      props({}).state.core,
    );
    expect(patch).toEqual({ feedback: { kind: 'wrong-answer' }, hint: null, wrongCount: 0 });
  });

  it('maps a solved (or ignored) answer to the solved note', () => {
    const action = { type: 'answer-choice', optionId: 'b' } as const;
    const core = props({}).state.core;
    expect(ui.toUi({ kind: 'solved' }, action, core).feedback).toEqual({ kind: 'solved' });
    expect(ui.toUi({ kind: 'ignored' }, action, core).feedback).toEqual({ kind: 'solved' });
  });

  it('seeds the extras from the def', () => {
    expect(ui.initUi(def)).toEqual({ wrongCount: 0 });
    expect(ui.type).toBe('choice');
  });

  it('shows the stimulus, Hint and the options, and dispatches answers and hints', () => {
    const dispatch = vi.fn();
    render(withI18n(ui.PlayArea(props({ wrongOptions: ['a'] }, dispatch))));
    expect(screen.getByText('problem card')).toBeTruthy();
    expect(screen.getByText('instruction')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Four 3' }).hasAttribute('disabled')).toBe(true);

    screen.getByRole('button', { name: 'Four 4' }).click();
    expect(dispatch).toHaveBeenCalledWith({ type: 'answer-choice', optionId: 'b' });
    screen.getByRole('button', { name: 'Hint' }).click();
    expect(dispatch).toHaveBeenCalledWith({ type: 'hint' });
  });

  it('replaces the options by the done block once solved, and gives them the full width without a stimulus', () => {
    const { unmount } = render(withI18n(ui.PlayArea(props({ solved: true }))));
    expect(screen.getByText('well done')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    unmount();

    const { container } = render(withI18n(ui.PlayArea(props({ errors: 6 }))));
    expect(screen.queryByText('problem card')).toBeNull();
    expect(container.firstElementChild?.className).toBe('flex min-h-0 flex-1 flex-col gap-4');
  });
});
