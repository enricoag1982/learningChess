// The math `SubjectWeb` pack (docs/refactor-v4.md §11): everything the platform reaches of math.
import type { SubjectWeb } from '@learn/platform-web/app/subject.ts';
import { mathCore } from '../core/math-core.ts';
import hedgehog from './art/hedgehog.webp';
import { createMathContentSource } from './adapters/content/bundled-content-source.ts';
import { EXERCISE_KIND_UI } from './kinds/ui-registry.ts';
import { SurfaceDemo, SurfaceStory, SurfaceView } from './surface.tsx';

const RANK_GLYPH: Readonly<Record<string, string>> = {
  counter: '1',
  adder: '+',
};

/** No mode UI of its own (the platform draws `series`), and no home tile, route, store slice, parent panel or dev playground. */
export const mathWeb = {
  core: mathCore,
  createServices: () => ({ content: createMathContentSource(), subject: {} }),
  kinds: EXERCISE_KIND_UI,
  modes: {},
  surface: { Story: SurfaceStory, Demo: SurfaceDemo, View: SurfaceView },
  art: { hedgehog },
  den: { rankGlyph: (rankId) => RANK_GLYPH[rankId] ?? '?' },
  routes: {},
} satisfies SubjectWeb;
