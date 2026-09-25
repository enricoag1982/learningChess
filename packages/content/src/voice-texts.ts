/**
 * Inventory of every narrated string (`docs/voice.md`): every `apps/web/src` call site of
 * `narrator.speak(...)` / `useNarratedText(...)` (~26, found by grep + manual trace), resolved to
 * literal English text via the same locale content the app renders from, deduped by `voiceKey`
 * (`packages/core`). `scripts/voice-texts.ts` writes this to `dist/voice-texts.json` and prints
 * the report; that report should be read before running `tools/voice/generate.py` on its output.
 *
 * Sources:
 * 1. Lesson/mini-game content (story, demo, guided/exercise/variant instructions, boss goals,
 *    series-round instructions) — one literal string per content entry, no templating.
 * 2. UI "owl line" templates (Home/Journey/Play/Assessment/Placement/Celebration/Den) — each is a
 *    single i18next key, expanded over the *bounded* domain of its variables (character/lesson/
 *    world/mini-game/badge names, bot level names, piece labels, small counts), derived from
 *    compiled content, never guessed.
 * 3. Two runtime string *concatenations* outside i18next (not a single `t()` call, so no manifest
 *    key can match them verbatim): the exercise instruction+feedback-note line (`exercise-text.ts`,
 *    every exercise × ~15 note shapes — unbounded, intentionally skipped, logged below: those reads
 *    fall back to Web Speech, same as any other narrated text with no generated audio) and the Den
 *    badge name+tier/condition line (bounded: 25 badges × ≤3 tiers/thresholds — expanded in full).
 */
import type {
  BadgeDef,
  CompiledContent,
  ExerciseDef,
  TracksCatalog,
  World,
} from '@chess-kids/core';
import { voiceKey } from '@chess-kids/core';
import type { Locales } from './load.ts';
import type { LocaleTree } from './schema.ts';

/** One inventoried narrated text. `source` is a short human label for the report, not machine-read. */
export interface InventoryEntry {
  readonly key: string;
  readonly text: string;
  readonly source: string;
}

/** A template whose bounded variable domain could not be established (or was too large) — logged, not generated. */
export interface SkippedTemplate {
  readonly source: string;
  readonly reason: string;
}

export interface VoiceInventory {
  readonly entries: readonly InventoryEntry[];
  readonly skipped: readonly SkippedTemplate[];
}

// ---------------------------------------------------------------------------------------------
// Minimal i18next-alike resolver: namespace (before `:`, default `common`) + dot path, `_one`/
// `_other` pluralisation keyed on a `count` var, `{{var}}` interpolation. Covers exactly what this
// app's own locale content uses (checked against `packages/content/locales/en/*.yaml`) — not a
// general-purpose i18next reimplementation.
// ---------------------------------------------------------------------------------------------

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

/** Grown-up-only strings (`docs/non-functional.md` §3: parent area, password, backup, privacy
 * policy) are never narrated to the kid — enforced here, not just by omission below, so a future
 * source added without checking this rule fails loudly instead of silently narrating one. */
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

// ---------------------------------------------------------------------------------------------
// Domains derived from content (never guessed — `docs/roadmap.md`/CLAUDE.md content-review rule).
// ---------------------------------------------------------------------------------------------

/** `apps/web/src/ui/art/character-meta.ts`'s `CHARACTER_PIECE` (single-letter `PieceType`, matches
 * the `piece.<letter>` locale keys — see `common.yaml`'s `piece:` block) — kept in sync by
 * `lessons.test.ts` covering every lesson character, so a future character shows up here as a new
 * lesson too, not silently falling through to the "Owl-taught" branch below. */
const CHARACTER_PIECE: Readonly<Record<string, string>> = {
  rhino: 'r',
  elephant: 'b',
  lioness: 'q',
  lion: 'k',
  horse: 'n',
  caterpillar: 'p',
};

function characterPieceOf(character: string): string | null {
  return CHARACTER_PIECE[character] ?? null;
}

const PIECE_CHARACTERS = new Set(Object.keys(CHARACTER_PIECE));

/** `apps/web/src/ui/lesson-character-labels.ts`'s `unlockLabel`/`journeyNodeLabel` rule: an
 * Owl-taught lesson (World 1, no piece character) is named by its own title; a piece character's
 * *first* lesson is named by the character; every later lesson of that character by its own title. */
function lessonDisplayName(
  locales: Locales,
  lesson: { character: string; titleKey: string },
): string {
  return PIECE_CHARACTERS.has(lesson.character)
    ? resolve(locales, `characters:${lesson.character}.name`)
    : resolve(locales, lesson.titleKey);
}

/** `docs/computer-opponent.md` §3: fixed Mouse → Bear ladder, mirrored here (not re-exported from
 * `@chess-kids/core`, so kept as the same 5-name literal the domain layer itself uses). */
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

// ---------------------------------------------------------------------------------------------
// Collection.
// ---------------------------------------------------------------------------------------------

function addText(entries: Map<string, InventoryEntry>, text: string, source: string): void {
  if (text.trim() === '') return;
  const key = voiceKey(text);
  const existing = entries.get(key);
  if (existing !== undefined && existing.text !== text) {
    // sha256 collision on genuinely different text — astronomically unlikely at this inventory's
    // scale; fail loudly rather than silently dropping one of the two texts' audio.
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
    if (minigame.mode === 'series') {
      addExerciseDefs(entries, locales, minigame.rounds, 'minigame-round');
    }
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
  // `unlockLabel` (`lesson-character-labels.ts`): the piece word for a piece character's *first*
  // lesson, else the lesson's own title — same rule as `lessonDisplayName` above, restated here
  // because `unlockLabel` uses the piece *word* ("Rook"), not the character *name* ("Rhino").
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

  // Plain owl lines with no variables (Session summary / Time limit / Practice / Den / Play /
  // Friend setup / First run) — included for completeness; `resolve` throws if any stop resolving.
  for (const key of [
    'session.summary-closing',
    'time-limit.body',
    'practice.owl-line',
    'den.owl-line',
    'play.owl-line',
    'friend-play.setup-owl-line',
    'first-run.welcome.owl',
  ]) {
    addText(entries, resolve(locales, key), 'owl-line');
  }
}

/** Den's badge tile: `${name}` / `${name}, <tier>` when earned, `${name}. <condition>` when not —
 * a JS-level concatenation outside i18next (`DenScreen.tsx`'s `speakBadge`), so no single manifest
 * key would match the interpolated form; bounded (25 badges × ≤3 tiers/thresholds), expanded here
 * to match exactly what the runtime concatenates. */
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

/** Builds the full inventory (`entries`, deduped by `voiceKey`, sorted by key) plus the report's
 * `skipped` list — pure function of already-loaded content, so both `scripts/voice-texts.ts` (real
 * content, writes `dist/voice-texts.json`) and this file's own tests (real content, no I/O) share it. */
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

  const skipped: SkippedTemplate[] = [
    {
      source: 'exercise-instruction+note (ExerciseStep/SeriesBossStep/ReviewExerciseStep)',
      reason:
        'runtime concatenates `${instructionText} ${note.text}` outside i18next; ' +
        `~${String(
          content.lessons.reduce((n, l) => n + l.guided.length + l.exercises.length, 0) +
            content.minigames.reduce((n, m) => n + (m.mode === 'series' ? m.rounds.length : 0), 0),
        )} instructions × ~15 note shapes is unbounded — falls back to Web Speech for that reading; ` +
        'the bare instruction (feedback.kind === "instruction", no note yet) is covered via lesson-guided/lesson-exercise/minigame-round above.',
    },
  ];

  return {
    entries: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)),
    skipped,
  };
}
