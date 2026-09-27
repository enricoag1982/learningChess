// Inventory of every narrated string, resolved to literal English text via the same locale content
// the app renders from, deduped by `voiceKey`: content strings, UI "owl line" templates expanded
// over each bounded domain, and runtime string concatenations outside i18next expanded to match.
import type {
  BadgeDef,
  CompiledContent,
  ExerciseDef,
  ExerciseFeedback,
  ExerciseNoteCtx,
  Hint,
  PieceType,
  Resolve,
  Stars,
  TracksCatalog,
  World,
} from '@chess-kids/core';
import { PLAY_FROM_OPTIONS, exerciseNote, isEasierOfferNote, voiceKey } from '@chess-kids/core';
import type { Locales } from './load.ts';
import { modeContentOf } from './modes/index.ts';
import type { LocaleTree } from './schema.ts';

/** One inventoried narrated text. `source` is a short human label for the report, not machine-read. */
export interface InventoryEntry {
  readonly key: string;
  readonly text: string;
  readonly source: string;
}

/** A template whose bounded variable domain could not be established — logged, not generated. */
export interface SkippedTemplate {
  readonly source: string;
  readonly reason: string;
}

export interface VoiceInventory {
  readonly entries: readonly InventoryEntry[];
  readonly skipped: readonly SkippedTemplate[];
}

// Minimal i18next-alike resolver: namespace + dot path, `_one`/`_other` pluralisation on a `count`
// var, `{{var}}` interpolation. Covers exactly what this app's locale content uses.

function resolveTree(tree: LocaleTree, dotPath: string): string | LocaleTree | undefined {
  let node: LocaleTree | string = tree;
  for (const segment of dotPath.split('.')) {
    if (typeof node === 'string') return undefined;
    const child: LocaleTree | string | undefined = node[segment];
    if (child === undefined) return undefined;
    node = child;
  }
  return node;
}

function interpolate(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

/** Grown-up-only strings are never narrated to the kid — enforced here so a future source added
 * without checking this rule fails loudly instead of silently narrating one. */
const EXCLUDED_KEY_PREFIXES = ['parent.', 'new-player.', 'backup.', 'privacy.'];

/** Resolves `fullKey` (e.g. `lessons:rook.story`, or `home.owl-next` for the default `common` namespace) to text. */
function resolve(
  locales: Locales,
  fullKey: string,
  vars: Readonly<Record<string, string | number>> = {},
): string {
  const separatorIndex = fullKey.indexOf(':');
  const namespace = separatorIndex < 0 ? 'common' : fullKey.slice(0, separatorIndex);
  const dotPath = separatorIndex < 0 ? fullKey : fullKey.slice(separatorIndex + 1);
  if (
    namespace === 'common' &&
    EXCLUDED_KEY_PREFIXES.some((prefix) => dotPath.startsWith(prefix))
  ) {
    throw new Error(`voice-texts: grown-up-only key must not be narrated: ${fullKey}`);
  }
  const tree = locales.en?.[namespace];
  if (tree === undefined) {
    throw new Error(`voice-texts: unknown namespace "${namespace}" (key "${fullKey}")`);
  }

  const count = vars.count;
  const pluralSuffix = typeof count === 'number' ? (count === 1 ? '_one' : '_other') : undefined;
  const node =
    (pluralSuffix !== undefined ? resolveTree(tree, dotPath + pluralSuffix) : undefined) ??
    resolveTree(tree, dotPath);
  if (typeof node !== 'string') {
    throw new Error(`voice-texts: key "${fullKey}" does not resolve to text`);
  }
  return interpolate(node, vars);
}

// Domains derived from content, never guessed.

/** Mirrors `apps/web/src/ui/art/character-meta.ts`'s `CHARACTER_PIECE` — kept in sync by
 * `lessons.test.ts` covering every lesson character. */
const CHARACTER_PIECE: Readonly<Record<string, PieceType>> = {
  rhino: 'r',
  elephant: 'b',
  lioness: 'q',
  lion: 'k',
  horse: 'n',
  caterpillar: 'p',
};

function characterPieceOf(character: string): PieceType | null {
  return CHARACTER_PIECE[character] ?? null;
}

const PIECE_CHARACTERS = new Set(Object.keys(CHARACTER_PIECE));

/** An Owl-taught lesson is named by its own title; a piece character's first lesson is named by
 * the character; every later lesson of that character by its own title. */
function lessonDisplayName(
  locales: Locales,
  lesson: { character: string; titleKey: string },
): string {
  return PIECE_CHARACTERS.has(lesson.character)
    ? resolve(locales, `characters:${lesson.character}.name`)
    : resolve(locales, lesson.titleKey);
}

/** Fixed Mouse → Bear ladder, mirrored here (not re-exported from `@chess-kids/core`). */
const BOT_LEVEL_NAMES = ['mouse', 'rabbit', 'fox', 'wolf', 'bear'] as const;

const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'] as const;

/** `PlayScreen.tsx`'s `levelConditionText`: either "full game locked" or "beat <name> 3 times". */
function levelConditionTexts(locales: Locales): readonly string[] {
  return [
    resolve(locales, 'play.full-game-locked'),
    ...BOT_LEVEL_NAMES.map((name) =>
      resolve(locales, 'play.level-condition-beat', {
        name: resolve(locales, `boss.versus.bot-name.${name}`),
        times: 3,
      }),
    ),
  ];
}

function addText(entries: Map<string, InventoryEntry>, text: string, source: string): void {
  if (text.trim() === '') return;
  const key = voiceKey(text);
  const existing = entries.get(key);
  if (existing !== undefined && existing.text !== text) {
    // sha256 collision on genuinely different text — fail loudly rather than silently drop audio.
    throw new Error(`voice-texts: key collision between "${existing.text}" and "${text}"`);
  }
  entries.set(key, { key, text, source });
}

function addExerciseDefs(
  entries: Map<string, InventoryEntry>,
  locales: Locales,
  defs: readonly ExerciseDef[],
  source: string,
): void {
  for (const def of defs) {
    addText(entries, resolve(locales, def.textKey), source);
  }
}

function collectContentEntries(
  entries: Map<string, InventoryEntry>,
  locales: Locales,
  content: CompiledContent,
): void {
  for (const lesson of content.lessons) {
    addText(entries, resolve(locales, lesson.storyKey), 'lesson-story');
    addText(entries, resolve(locales, lesson.demo.textKey), 'lesson-demo');
    addExerciseDefs(entries, locales, lesson.guided, 'lesson-guided');
    addExerciseDefs(entries, locales, lesson.exercises, 'lesson-exercise');
    addExerciseDefs(entries, locales, lesson.variants ?? [], 'lesson-variant');
  }

  for (const minigame of content.minigames) {
    addText(entries, resolve(locales, minigame.goalKey), 'minigame-goal');
    const rounds = modeContentOf(minigame.mode).exercises?.(minigame) ?? [];
    addExerciseDefs(entries, locales, rounds, 'minigame-round');
  }
}

/** Home/Journey/Play/Assessment/Placement/Celebration/Den "owl line" templates — one `t()` call
 * each, expanded over each variable's bounded, content-derived domain. */
function collectUiTemplates(
  entries: Map<string, InventoryEntry>,
  locales: Locales,
  content: CompiledContent,
  catalog: TracksCatalog,
  badges: readonly BadgeDef[],
): void {
  const worlds: readonly World[] = catalog.tracks.flatMap((track) => track.worlds);
  const minigameById = new Map(content.minigames.map((m) => [m.id, m] as const));
  const lessonNames = content.lessons.map((lesson) => lessonDisplayName(locales, lesson));
  const pieceLessonNames = content.lessons
    .filter((lesson) => PIECE_CHARACTERS.has(lesson.character))
    .map((lesson) => lessonDisplayName(locales, lesson));
  const owlLessonNames = content.lessons
    .filter((lesson) => !PIECE_CHARACTERS.has(lesson.character))
    .map((lesson) => lessonDisplayName(locales, lesson));

  // Home: next-step owl line.
  addText(entries, resolve(locales, 'home.owl-warmup-only'), 'home');
  addText(entries, resolve(locales, 'home.owl-all-done'), 'home');
  addText(entries, resolve(locales, 'home.owl-resume'), 'home');
  for (const title of pieceLessonNames) {
    addText(entries, resolve(locales, 'home.owl-next', { character: title }), 'home');
  }
  for (const topic of owlLessonNames) {
    addText(entries, resolve(locales, 'home.owl-next-topic', { topic }), 'home');
  }
  for (const world of worlds) {
    if (world.boss === undefined) continue;
    const boss = minigameById.get(world.boss);
    if (boss === undefined) continue;
    addText(
      entries,
      resolve(locales, 'home.owl-world-boss', { title: resolve(locales, boss.titleKey) }),
      'home',
    );
  }

  // Journey: locked-lesson / locked-world messages, and the "show you know it?" offer.
  for (const name of lessonNames) {
    addText(entries, resolve(locales, 'journey:ui.finish-first', { name }), 'journey');
    addText(entries, resolve(locales, 'journey:ui.test-out-lesson-question', { name }), 'journey');
  }
  for (const world of worlds) {
    addText(
      entries,
      resolve(locales, 'journey:ui.test-out-world-question', {
        order: world.order,
        name: resolve(locales, world.titleKey),
      }),
      'journey',
    );
  }

  // Play: locked computer level / locked mini-game / locked vs-friend messages.
  const conditionTexts = levelConditionTexts(locales);
  for (const name of BOT_LEVEL_NAMES) {
    for (const condition of conditionTexts) {
      addText(
        entries,
        resolve(locales, 'play.level-name-locked', {
          name: resolve(locales, `boss.versus.bot-name.${name}`),
          condition,
        }),
        'play',
      );
    }
    addText(
      entries,
      resolve(locales, 'play.level-up-suggestion', {
        name: resolve(locales, `boss.versus.bot-name.${name}`),
      }),
      'play',
    );
  }
  // `unlockLabel`: the piece word for a piece character's first lesson, else the lesson's title.
  const firstLessonOfCharacter = new Map<string, string>();
  for (const lesson of content.lessons) {
    if (!firstLessonOfCharacter.has(lesson.character)) {
      firstLessonOfCharacter.set(lesson.character, lesson.id);
    }
  }
  for (const lesson of content.lessons) {
    const piece = characterPieceOf(lesson.character);
    const isFirstOfCharacter = firstLessonOfCharacter.get(lesson.character) === lesson.id;
    const label =
      piece !== null && isFirstOfCharacter
        ? resolve(locales, `piece.${piece}`)
        : resolve(locales, lesson.titleKey);
    addText(entries, resolve(locales, 'play.locked-condition', { label }), 'play');
  }
  for (const minigame of content.minigames) {
    addText(
      entries,
      resolve(locales, 'play.locked-condition', { label: resolve(locales, minigame.titleKey) }),
      'play',
    );
  }
  addText(entries, resolve(locales, 'play.vs-friend-locked'), 'play');

  // Versus boss (Pawn Wars, …): bot move / capture / result lines.
  for (const name of BOT_LEVEL_NAMES) {
    for (const piece of PIECE_TYPES) {
      addText(
        entries,
        resolve(locales, 'boss.versus.bot-captured', {
          name: resolve(locales, `boss.versus.bot-name.${name}`),
          piece: resolve(locales, `board.piece.${piece}`),
        }),
        'versus-boss',
      );
      addText(
        entries,
        resolve(locales, 'boss.versus.bot-moved', {
          name: resolve(locales, `boss.versus.bot-name.${name}`),
          piece: resolve(locales, `board.piece.${piece}`),
        }),
        'versus-boss',
      );
    }
  }
  for (const piece of PIECE_TYPES) {
    addText(
      entries,
      resolve(locales, 'boss.versus.kid-captured', {
        piece: resolve(locales, `board.piece.${piece}`),
      }),
      'versus-boss',
    );
  }
  addText(entries, resolve(locales, 'boss.versus.won'), 'versus-boss');
  addText(entries, resolve(locales, 'boss.versus.draw'), 'versus-boss');
  addText(entries, resolve(locales, 'boss.versus.lost'), 'versus-boss');

  // Assessment result.
  addText(entries, resolve(locales, 'assessment.fail-body'), 'assessment');
  for (const lesson of content.lessons) {
    addText(
      entries,
      resolve(locales, 'assessment.pass-body', {
        count: 1,
        name: lessonDisplayName(locales, lesson),
      }),
      'assessment',
    );
  }
  for (const world of worlds) {
    const worldLessonCount = content.lessons.filter((lesson) => lesson.world === world.id).length;
    if (worldLessonCount === 0) continue;
    addText(
      entries,
      resolve(locales, 'assessment.pass-body', {
        count: worldLessonCount,
        name: resolve(locales, world.titleKey),
      }),
      'assessment',
    );
  }

  // Placement.
  addText(entries, resolve(locales, 'placement.offer-question'), 'placement');
  addText(entries, resolve(locales, 'placement.summary-none-body'), 'placement');
  addText(entries, resolve(locales, 'placement.summary-all-body'), 'placement');
  const basicsWorldCount =
    catalog.tracks.find((track) => track.id === 'basics')?.worlds.length ?? 0;
  for (let passedCount = 1; passedCount < basicsWorldCount; passedCount++) {
    addText(
      entries,
      resolve(locales, 'placement.summary-passed-body', { count: passedCount }),
      'placement',
    );
  }

  // Celebration: badge-earned owl line.
  for (const badge of badges) {
    addText(
      entries,
      resolve(locales, 'celebration.owl-line', { name: resolve(locales, badge.nameKey) }),
      'celebration',
    );
  }

  // Plain owl lines with no variables, included for completeness.
  for (const key of [
    'session.summary-closing',
    'time-limit.body',
    'time-limit.late-body',
    'notice.five-minutes',
    'practice.owl-line',
    'den.owl-line',
    'play.owl-line',
    'friend-play.setup-owl-line',
    'first-run.welcome.owl',
  ]) {
    addText(entries, resolve(locales, key), 'owl-line');
  }

  // Time limit "too early": bounded by the parent's "Not before" options.
  for (const time of PLAY_FROM_OPTIONS) {
    if (time !== null)
      addText(entries, resolve(locales, 'time-limit.early-body', { time }), 'owl-line');
  }
}

/** Den's badge tile: `${name}` / `${name}, <tier>` when earned, `${name}. <condition>` when not —
 * a JS-level concatenation outside i18next, expanded here to match what the runtime concatenates. */
const TIER_NAMES = ['tier.bronze', 'tier.silver', 'tier.gold'];

function collectBadgeSpokenLines(
  entries: Map<string, InventoryEntry>,
  locales: Locales,
  badges: readonly BadgeDef[],
): void {
  for (const badge of badges) {
    const name = resolve(locales, badge.nameKey);
    const thresholds = badge.condition.thresholds;
    const tiered = thresholds.length > 1;
    if (tiered) {
      for (let index = 0; index < thresholds.length; index++) {
        const tierKey = TIER_NAMES[index];
        if (tierKey === undefined) continue;
        const tierName = resolve(locales, tierKey);
        addText(entries, `${name}, ${tierName}`, 'badge-earned');
      }
    } else {
      addText(entries, name, 'badge-earned');
    }
    for (const threshold of thresholds) {
      const condition = resolve(locales, badge.conditionKey, { count: threshold });
      addText(entries, `${name}. ${condition}`, 'badge-locked');
    }
  }
}

/** Every `EXERCISE_NOTES` entry's text, spoken as its own utterance — via the same `exerciseNote`
 * dispatch the app calls, instead of mirroring its logic by hand. Each note shape's domain is
 * bounded and content-derived: every lesson character (and the piece it stands for, defaulting to
 * rook), 1-3 stars, colour × piece type, one sample `Hint` per distinct wording. Error-kind notes
 * (`isEasierOfferNote`) also get the easier-variant-offer sentence appended, since `ExerciseStep`
 * shows that offer on them. */
function collectExerciseNoteTexts(
  entries: Map<string, InventoryEntry>,
  locales: Locales,
  content: CompiledContent,
): void {
  const r: Resolve = (key, vars) => resolve(locales, key, vars);
  const characters = [...new Set(content.lessons.map((lesson) => lesson.character))];
  const placeholderCtx: ExerciseNoteCtx = { name: '', piece: 'r', stars: 3 };

  function addNote(feedback: ExerciseFeedback, ctx: ExerciseNoteCtx): void {
    if (feedback.kind === 'instruction') return;
    const plain = exerciseNote(r, feedback, ctx, false);
    if (plain === undefined) return;
    addText(entries, plain.text, 'exercise-note');
    if (isEasierOfferNote(feedback.kind)) {
      const withOffer = exerciseNote(r, feedback, ctx, true);
      if (withOffer) addText(entries, withOffer.text, 'exercise-note-easier-offer');
    }
  }

  // Every character's own display name and the piece it stands for (default rook).
  const ctxByCharacter = characters.map((character) => ({
    name: resolve(locales, `characters:${character}.name`),
    piece: characterPieceOf(character) ?? 'r',
  }));

  // tap-first (never gets the easier offer: not an error kind) and illegal move (its own piece).
  for (const { name, piece } of ctxByCharacter) {
    addNote({ kind: 'tap-first' }, { name, piece, stars: 3 });
    addNote({ kind: 'illegal' }, { name, piece, stars: 3 });
  }

  // Plain error notes with no variables.
  addNote({ kind: 'select-wrong' }, placeholderCtx);
  addNote({ kind: 'select-missing' }, placeholderCtx);
  addNote({ kind: 'select-both' }, placeholderCtx);
  addNote({ kind: 'wrong-answer' }, placeholderCtx);
  addNote({ kind: 'wrong-move' }, placeholderCtx);
  addNote({ kind: 'wrong-placement' }, placeholderCtx);

  // Hint ladder (never gets the easier offer). Level-1 "squares" (piece hint) is the only shape
  // that varies by character; every other shape's text is character-independent.
  for (const { name, piece } of ctxByCharacter) {
    addNote(
      { kind: 'hint', hint: { kind: 'squares', level: 1, squares: [] } },
      { name, piece, stars: 3 },
    );
  }
  const otherHints: readonly Hint[] = [
    { kind: 'squares', level: 2, squares: [] },
    { kind: 'squares', level: 3, squares: [] },
    { kind: 'yes-no', level: 1, squares: [], reveal: false },
    { kind: 'yes-no', level: 2, squares: [], reveal: false },
    { kind: 'yes-no', level: 3, squares: [], reveal: true },
    { kind: 'choice', level: 1, reveal: false },
    { kind: 'choice', level: 3, reveal: true },
    { kind: 'setup', level: 2, piece: { color: 'w', type: 'p' }, square: 'a1', placed: false },
    { kind: 'setup', level: 3, piece: { color: 'w', type: 'p' }, square: 'a1', placed: true },
  ];
  for (const hint of otherHints) {
    addNote({ kind: 'hint', hint }, placeholderCtx);
  }
  for (const color of ['w', 'b'] as const) {
    for (const type of PIECE_TYPES) {
      addNote(
        { kind: 'hint', hint: { kind: 'setup', level: 1, piece: { color, type }, placed: false } },
        placeholderCtx,
      );
    }
  }

  // Praise (solved), 1-3 stars; checkmate concatenates the "Checkmate!" line with the same praise.
  for (const stars of [1, 2, 3] as const satisfies readonly Stars[]) {
    addNote({ kind: 'solved' }, { ...placeholderCtx, stars });
    addNote({ kind: 'checkmate' }, { ...placeholderCtx, stars });
  }

  // Opponent's scripted reply (mate-in-n): colour × piece.
  for (const color of ['w', 'b'] as const) {
    for (const piece of PIECE_TYPES) {
      addNote(
        { kind: 'opponent-reply', reply: { from: 'a1', to: 'a2', san: 'a2', color, piece } },
        placeholderCtx,
      );
    }
  }
}

/** Builds the full inventory (deduped by `voiceKey`, sorted by key) plus the report's `skipped`
 * list — a pure function of already-loaded content. */
export function buildVoiceInventory(
  locales: Locales,
  content: CompiledContent,
  catalog: TracksCatalog,
  badges: readonly BadgeDef[],
): VoiceInventory {
  const entries = new Map<string, InventoryEntry>();
  collectContentEntries(entries, locales, content);
  collectUiTemplates(entries, locales, content, catalog, badges);
  collectBadgeSpokenLines(entries, locales, badges);
  collectExerciseNoteTexts(entries, locales, content);
  addText(entries, resolve(locales, 'voice-check.sentence'), 'voice-check');

  // Nothing is skipped any more; kept as an empty list so a future unbounded template can log itself.
  const skipped: SkippedTemplate[] = [];

  return {
    entries: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)),
    skipped,
  };
}
