import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Lesson } from '@learn/subject-chess';
import type { ExerciseDef } from '@learn/subject-chess';
import { createAppStore, StoreProvider } from '../app/store.ts';
import { PackProvider } from '../app/subject.ts';
import { chessWeb } from '../chess-pack.ts';
import { ExerciseStep } from '../ui/lesson/ExerciseStep.tsx';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { createTestServices } from '../testing/test-services.ts';

interface ExerciseSample {
  readonly label: string;
  readonly def: ExerciseDef;
}

/** Every exercise kind's own `sample.ts` (dev-only fixtures), one glob per type folder. */
const SAMPLE_MODULES = import.meta.glob<{ readonly samples: readonly ExerciseSample[] }>(
  '../kinds/*/sample.ts',
  { eager: true },
);
const EXERCISES: readonly ExerciseSample[] = Object.values(SAMPLE_MODULES)
  .flatMap((module) => module.samples)
  .sort((a, b) => a.label.localeCompare(b.label));

/** Full-viewport preview of one exercise, wrapped like `LessonScreen` wraps `ExerciseStep`:
 * `GameLayout`'s `lg:` breakpoint reacts to the page viewport, not a boxed preview. */
function ExercisePreview({
  lesson,
  def,
}: {
  readonly lesson: Lesson;
  readonly def: ExerciseDef;
}): JSX.Element {
  const [store] = useState(() =>
    createAppStore(createTestServices(fixtureContentSource(lesson)), chessWeb),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void store
      .getState()
      .init()
      .then(() => {
        setReady(true);
      });
  }, [store]);

  if (!ready) return <p className="text-muted">Loading…</p>;

  return (
    <PackProvider value={chessWeb}>
      <StoreProvider value={store}>
        {/* LessonScreen's real header (close button + phase pills + stage dots) leaves less height
            for GameLayout than this playground's single tab row; cap it so the board doesn't grow
            past what the panel column can match at 1024x768 (a dev-harness-only concern). */}
        <div className="flex min-h-0 max-h-[560px] flex-1 flex-col">
          <ExerciseStep
            key={def.id}
            lesson={lesson}
            exercise={def}
            guided={false}
            nextStepIndex={1}
          />
        </div>
      </StoreProvider>
    </PackProvider>
  );
}

/** Dev-only visual harness for every exercise kind (`kinds/<type>/sample.ts`), at `/#exercises`. */
export function ExercisePlayground(): JSX.Element {
  const [selected, setSelected] = useState(0);
  const current = EXERCISES[selected] ?? EXERCISES[0];
  if (!current) {
    return <p>No exercises configured.</p>;
  }
  const lesson = fixtureLesson({ guided: [], exercises: [current.def] });

  return (
    <main className="flex h-dvh flex-col gap-3 bg-cream px-3 py-3 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg text-ink">Exercise playground (dev only):</span>
        {EXERCISES.map(({ label }, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setSelected(index);
            }}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold capitalize ${
              index === selected ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ExercisePreview key={current.def.id} lesson={lesson} def={current.def} />
    </main>
  );
}
