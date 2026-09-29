// Math's lesson surfaces (`SubjectWeb.surface`): the problem card where chess draws its board.
import type { JSX } from 'react';
import type { SurfaceContext } from '@learn/platform-web/app/subject.ts';
import { evaluate } from '../core/problem.ts';
import type { MathLesson, MathState } from '../core/types.ts';
import { ProblemCard } from './problem-card.tsx';

/** Story card: the demo problem with its dots, small on a phone column (`compact`) or beside the text. */
export function SurfaceStory({
  lesson,
  compact,
}: {
  readonly lesson: MathLesson;
  readonly compact: boolean;
}): JSX.Element {
  const card = <ProblemCard problem={lesson.demo.problem} dots compact />;
  return compact ? (
    <div className="mx-auto h-32 w-full max-w-[240px]">{card}</div>
  ) : (
    <div className="h-36 w-36 flex-shrink-0 sm:h-52 sm:w-52">{card}</div>
  );
}

/** The demo: the problem, its dots and the result. */
export function SurfaceDemo({ lesson }: { readonly lesson: MathLesson }): JSX.Element {
  const { problem } = lesson.demo;
  return <ProblemCard problem={problem} dots answer={evaluate(problem)} />;
}

/** A finished round's card: its problem and result. */
export function SurfaceView({
  state,
}: {
  readonly state: MathState;
  readonly surface: SurfaceContext;
}): JSX.Element {
  const { problem } = state.def;
  return problem === undefined ? (
    <div />
  ) : (
    <ProblemCard problem={problem} dots={false} answer={evaluate(problem)} />
  );
}
