import type { JSX } from 'react';
import type { AnswerChoiceAction } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import type { PlayAreaProps } from '@learn/platform-web/kinds/kind-ui.ts';
import { evaluate } from '../../core/problem.ts';
import type { MathChoiceDef, MathState } from '../../core/types.ts';
import { ProblemCard } from '../../web/problem-card.tsx';

/** What a choice answers: the problem card (its dots once a hint was asked, its result once solved). Without a `problem`
 * the options take the full width. */
export function ProblemStimulus({
  def,
  state,
}: PlayAreaProps<MathChoiceDef, MathState<MathChoiceDef>, AnswerChoiceAction>): JSX.Element | null {
  if (def.problem === undefined) return null;
  return (
    <ProblemCard
      problem={def.problem}
      dots={state.core.hintLevel >= 1}
      answer={state.core.solved ? evaluate(def.problem) : undefined}
    />
  );
}
