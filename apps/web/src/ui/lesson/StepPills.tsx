import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonPhase } from '@chess-kids/core';

const PHASES: readonly LessonPhase[] = ['story', 'demo', 'try', 'exercises', 'boss'];

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Story · Demo · Try · Exercises · Boss: current = orange fill, done = green check, rest muted. */
export function StepPills({ current }: { readonly current: LessonPhase }): JSX.Element {
  const { t } = useTranslation();
  const currentIndex = PHASES.indexOf(current);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PHASES.map((phase, index) => {
        const done = index < currentIndex;
        const isCurrent = index === currentIndex;
        const classes = isCurrent
          ? 'bg-today text-white'
          : done
            ? 'bg-go text-white'
            : 'bg-[#F1E9D8] text-muted';
        return (
          <span
            key={phase}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold sm:text-base ${classes}`}
          >
            {done && <CheckIcon />}
            {t(`lesson.steps.${phase}`)}
          </span>
        );
      })}
    </div>
  );
}
