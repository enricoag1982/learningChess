import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { ExerciseDef, Lesson, MiniGame } from '@chess-kids/core';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createAppStore, StoreProvider } from '../app/store.ts';
import { BossStep } from '../ui/lesson/BossStep.tsx';
import { DemoStep } from '../ui/lesson/DemoStep.tsx';
import { ExerciseStep } from '../ui/lesson/ExerciseStep.tsx';
import { StoryStep } from '../ui/lesson/StoryStep.tsx';
import { createTestServices } from '../testing/test-services.ts';

const content = createBundledContentSource();

type View =
  | { readonly kind: 'story' }
  | { readonly kind: 'demo' }
  | { readonly kind: 'exercise'; readonly exercise: ExerciseDef }
  | { readonly kind: 'boss'; readonly game: MiniGame };

/**
 * Renders one lesson step full-viewport, the same way `LessonScreen` wraps it (see
 * `ExercisePlayground.tsx`: `GameLayout`'s `lg:` breakpoint reacts to the page viewport).
 */
function StepPreview({
  lesson,
  view,
}: {
  readonly lesson: Lesson;
  readonly view: View;
}): JSX.Element {
  const [store] = useState(() => createAppStore(createTestServices(content)));
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
    <StoreProvider value={store}>
      <div className="flex min-h-0 max-h-[560px] flex-1 flex-col">
        {view.kind === 'story' && (
          <StoryStep lesson={lesson} onNext={() => undefined} onSkip={() => undefined} />
        )}
        {view.kind === 'demo' && (
          <DemoStep lesson={lesson} onNext={() => undefined} onSkip={() => undefined} />
        )}
        {view.kind === 'exercise' && (
          <ExerciseStep
            key={view.exercise.id}
            lesson={lesson}
            exercise={view.exercise}
            guided={false}
            nextStepIndex={1}
          />
        )}
        {view.kind === 'boss' && (
          <BossStep key={view.game.id} lesson={lesson} game={view.game} nextStepIndex={1} />
        )}
      </div>
    </StoreProvider>
  );
}

const LESSON_IDS = ['squares', 'lines', 'setup', 'rook', 'bishop', 'queen', 'king', 'knight'];

function parseHash(): { readonly lessonId: string; readonly view: string } {
  const raw = location.hash.startsWith('#lesson=') ? location.hash.slice('#lesson='.length) : '';
  const [lessonId, view] = raw.split('&view=');
  return { lessonId: lessonId ?? LESSON_IDS[0] ?? 'rook', view: view ?? 'demo' };
}

/**
 * Dev-only visual harness for a lesson's demo, exercises and boss, at `/#lesson=<id>&view=<view>`
 * (`view` = `demo`, `boss`, or an exercise id). Renders the real bundled content, not a fixture, so
 * it doubles as a manual check that new content displays correctly (see `docs/roadmap.md` M2.3).
 */
export function LessonPreview(): JSX.Element {
  const initial = parseHash();
  const [lessonId, setLessonId] = useState(initial.lessonId);
  const [viewId, setViewId] = useState(initial.view);

  // Reacts to the hash changing outside the buttons below too (typed/scripted navigation, e.g.
  // Playwright driving screenshots via `page.goto`): a fragment-only navigation never reloads the
  // page, so without this the component would otherwise keep showing whatever it first mounted with.
  useEffect(() => {
    function onHashChange(): void {
      const next = parseHash();
      setLessonId(next.lessonId);
      setViewId(next.view);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const lesson = content.lesson(lessonId);
  if (!lesson) {
    return <p className="p-6">No lesson "{lessonId}" in the bundled content.</p>;
  }
  const boss = lesson.boss === undefined ? undefined : content.minigame(lesson.boss);
  const exercises = [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])];

  const view: View =
    viewId === 'story'
      ? { kind: 'story' }
      : viewId === 'demo'
        ? { kind: 'demo' }
        : viewId === 'boss' && boss !== undefined
          ? { kind: 'boss', game: boss }
          : (() => {
              const exercise = exercises.find((candidate) => candidate.id === viewId);
              return exercise ? { kind: 'exercise', exercise } : { kind: 'demo' };
            })();

  function selectView(next: string): void {
    setViewId(next);
    location.hash = `#lesson=${lessonId}&view=${next}`;
  }

  return (
    <main className="flex h-dvh flex-col gap-3 bg-cream px-3 py-3 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg text-ink">Lesson preview (dev only):</span>
        {LESSON_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setLessonId(id);
              setViewId('demo');
              location.hash = `#lesson=${id}&view=demo`;
            }}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold capitalize ${
              id === lessonId ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            selectView('story');
          }}
          className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
            viewId === 'story' ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
          }`}
        >
          story
        </button>
        <button
          type="button"
          onClick={() => {
            selectView('demo');
          }}
          className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
            viewId === 'demo' ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
          }`}
        >
          demo
        </button>
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => {
              selectView(exercise.id);
            }}
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
              viewId === exercise.id ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
            }`}
          >
            {exercise.id}
          </button>
        ))}
        {boss !== undefined && (
          <button
            type="button"
            onClick={() => {
              selectView('boss');
            }}
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
              viewId === 'boss' ? 'border-go bg-go text-white' : 'border-line bg-card text-ink'
            }`}
          >
            boss
          </button>
        )}
      </div>
      <StepPreview key={`${lessonId}-${viewId}`} lesson={lesson} view={view} />
    </main>
  );
}
