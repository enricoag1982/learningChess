import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type {
  BestMoveDef,
  ChoiceDef,
  ExerciseDef,
  Lesson,
  MateInNDef,
  Position,
  SelectSquaresDef,
  SetupDef,
  YesNoDef,
} from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import { createAppStore, StoreProvider } from '../app/store.ts';
import { ExerciseStep } from '../ui/lesson/ExerciseStep.tsx';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { createTestServices } from '../testing/test-services.ts';

const YES_NO_EXERCISE: YesNoDef = {
  id: 'dev-yn',
  concept: 'hanging-piece',
  textKey: 'fixtures:dev-yn',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . p . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
  `),
  type: 'yes-no',
  answer: true,
  focus: 'e4',
};

const CHOICE_EXERCISE: ChoiceDef = {
  id: 'dev-ch',
  concept: 'exchange',
  textKey: 'fixtures:dev-ch',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    R . . . . . . .
  `),
  type: 'choice',
  showBoard: false,
  options: [
    { id: 'queen', piece: { color: 'w', type: 'q' } },
    { id: 'rook', piece: { color: 'w', type: 'r' } },
    { id: 'bishop', piece: { color: 'w', type: 'b' } },
  ],
  answer: 'queen',
};

const BEST_MOVE_EXERCISE: BestMoveDef = {
  id: 'dev-bm',
  concept: 'rook-move',
  textKey: 'fixtures:dev-bm',
  position: parseDiagram(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    R . . . . . . .
  `),
  type: 'best-move',
  solutions: ['Ra8'],
};

const SETUP_TARGET: Position = parseDiagram(`
  . . . . . . . r
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  R . . . . . . .
`);
const SETUP_START: Position = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
};
const SETUP_EXERCISE: SetupDef = {
  id: 'dev-su',
  concept: 'board-setup',
  textKey: 'fixtures:dev-su',
  position: SETUP_START,
  type: 'setup',
  target: SETUP_TARGET,
};

// 1.Ne7+ Kh8 2.Qa8# — mate in 2, kid = White; Kf8 is also legal but the line scripts Kh8, so the
// reply's ~600ms reveal (ExerciseStep.tsx) and its "Black moved the king." narration show up here.
const MATE_IN_2_EXERCISE: MateInNDef = {
  id: 'dev-mate2',
  concept: 'mate-in-2',
  textKey: 'fixtures:dev-mate2',
  position: parseDiagram(`
    . . . . . . k .
    . . . . . p p p
    . . N . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    Q K . . . . . .
  `),
  type: 'mate-in-n',
  n: 2,
  line: ['Ne7+', 'Kh8', 'Qa8#'],
};

// White king g1, in check from the rook on g8; f2/h2 are the kid's own pawns, so f1 and h1 are the
// only legal king moves — the exact squares `derive: check-escapes` should select.
const CHECK_ESCAPES_EXERCISE: SelectSquaresDef = {
  id: 'dev-check-escapes',
  concept: 'check-escape',
  textKey: 'fixtures:dev-check-escapes',
  position: parseDiagram(`
    k . . . . . r .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . P . P
    . . . . . . K .
  `),
  type: 'select-squares',
  answer: { derive: 'check-escapes' },
};

// White pawn on e4 attacks d5 and f5 diagonally only, own piece (d5) or enemy (f5) alike — never
// e5, straight ahead of it.
const ATTACKED_BY_EXERCISE: SelectSquaresDef = {
  id: 'dev-attacked-by',
  concept: 'attack',
  textKey: 'fixtures:dev-attacked-by',
  position: parseDiagram(`
    . . . . . . k .
    . . . . . . . .
    . . . . . . . .
    . . . P . p . .
    . . . . P . . .
    . . . . . . . .
    . . . . . . . .
    . . . . K . . .
  `),
  type: 'select-squares',
  answer: { derive: 'attacked-by', from: 'e4' },
};

const EXERCISES: readonly { readonly label: string; readonly def: ExerciseDef }[] = [
  { label: 'yes-no', def: YES_NO_EXERCISE },
  { label: 'choice', def: CHOICE_EXERCISE },
  { label: 'best-move', def: BEST_MOVE_EXERCISE },
  { label: 'setup', def: SETUP_EXERCISE },
  { label: 'mate-in-2', def: MATE_IN_2_EXERCISE },
  { label: 'check-escapes', def: CHECK_ESCAPES_EXERCISE },
  { label: 'attacked-by', def: ATTACKED_BY_EXERCISE },
];

/**
 * Full-viewport preview of one exercise, wrapped the same way `LessonScreen` wraps `ExerciseStep`
 * (see `LessonScreen.tsx`): `GameLayout`'s `lg:` side-by-side breakpoint reacts to the *page*
 * viewport, so a small boxed preview would clip at desktop widths instead of laying out correctly.
 */
function ExercisePreview({
  lesson,
  def,
}: {
  readonly lesson: Lesson;
  readonly def: ExerciseDef;
}): JSX.Element {
  const [store] = useState(() => createAppStore(createTestServices(fixtureContentSource(lesson))));
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
  );
}

/** Dev-only visual harness for the new exercise types (yes-no, choice, best-move, setup), at `/#exercises`. */
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
