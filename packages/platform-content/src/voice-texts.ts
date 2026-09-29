// Inventory of every narrated string, resolved to literal English text via the same locale content
// the app renders from, deduped by `voiceKey`: content strings, UI "owl line" templates expanded
// over each bounded domain, and runtime string concatenations outside i18next expanded to match.
import type {
  BadgeDef,
  CompiledContent,
  ExerciseDefBase,
  TracksCatalog,
  World,
} from '@learn/platform-core';
import { PLAY_FROM_OPTIONS, voiceKey } from '@learn/platform-core';
import type { Locales } from './load.ts';
import type { LocaleTree } from './schema.ts';
import type { SubjectContent } from './subject.ts';

/** One inventoried narrated text. `source` is a short human label for the report, not machine-read. */
export interface InventoryEntry {
  readonly key: string;
  readonly text: string;
  readonly source: string;
}

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

/** Grown-up-only strings are never narrated to the kid; enforced here so a new source added without this rule fails loudly. */
const EXCLUDED_KEY_PREFIXES = ['parent.', 'new-player.', 'backup.', 'privacy.'];

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

/** The piece a lesson character stands for, from the subject's own `characters` (one source,
 * `topicKey`, e.g. `piece.r`); `null` for a narrator-taught (Owl) character. */
function characterPieceOf(
  characters: SubjectContent['characters'],
  character: string,
): string | null {
  const topicKey = characters[character]?.topicKey;
  return topicKey?.startsWith('piece.') ? topicKey.slice('piece.'.length) : null;
}

/** An Owl-taught lesson is named by its own title; a piece character's first lesson is named by
 * the character; every later lesson of that character by its own title. */
function lessonDisplayName(
  locales: Locales,
  characters: SubjectContent['characters'],
  lesson: { character: string; titleKey: string },
): string {
  return lesson.character in characters
    ? resolve(locales, `characters:${lesson.character}.name`)
    : resolve(locales, lesson.titleKey);
}

const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'] as const;

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
  defs: readonly ExerciseDefBase[],
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
  subject: SubjectContent,
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
    const rounds = subject.modes[minigame.mode]?.exercises?.(minigame) ?? [];
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
  subject: SubjectContent,
): void {
  const worlds: readonly World[] = catalog.tracks.flatMap((track) => track.worlds);
  const minigameById = new Map(content.minigames.map((m) => [m.id, m] as const));
  const lessonNames = content.lessons.map((lesson) =>
    lessonDisplayName(locales, subject.characters, lesson),
  );
  const pieceLessonNames = content.lessons
    .filter((lesson) => lesson.character in subject.characters)
    .map((lesson) => lessonDisplayName(locales, subject.characters, lesson));
  const owlLessonNames = content.lessons
    .filter((lesson) => !(lesson.character in subject.characters))
    .map((lesson) => lessonDisplayName(locales, subject.characters, lesson));

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

  // Play: locked computer level / locked mini-game / locked vs-friend messages, and the versus
  // boss's own bot move / capture lines — the subject's own (chess: bot-level names, pieces).
  subject.voiceTemplates(
    (text, source) => {
      addText(entries, text, source);
    },
    (key, vars) => resolve(locales, key, vars),
    content,
  );

  // `unlockLabel`: the piece word for a piece character's first lesson, else the lesson's title.
  const firstLessonOfCharacter = new Map<string, string>();
  for (const lesson of content.lessons) {
    if (!firstLessonOfCharacter.has(lesson.character)) {
      firstLessonOfCharacter.set(lesson.character, lesson.id);
    }
  }
  for (const lesson of content.lessons) {
    const piece = characterPieceOf(subject.characters, lesson.character);
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

  // Versus boss (Pawn Wars, …): kid-captured / result lines (bot move/capture: voiceTemplates above).
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

  addText(entries, resolve(locales, 'assessment.fail-body'), 'assessment');
  for (const lesson of content.lessons) {
    addText(
      entries,
      resolve(locales, 'assessment.pass-body', {
        count: 1,
        name: lessonDisplayName(locales, subject.characters, lesson),
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

  for (const badge of badges) {
    addText(
      entries,
      resolve(locales, 'celebration.owl-line', { name: resolve(locales, badge.nameKey) }),
      'celebration',
    );
  }

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

/** Deduped by `voiceKey`, sorted by key, plus the report's `skipped` list; pure over already-loaded content. */
export function buildVoiceInventory(
  locales: Locales,
  content: CompiledContent,
  catalog: TracksCatalog,
  badges: readonly BadgeDef[],
  subject: SubjectContent,
): VoiceInventory {
  const entries = new Map<string, InventoryEntry>();
  collectContentEntries(entries, locales, content, subject);
  collectUiTemplates(entries, locales, content, catalog, badges, subject);
  collectBadgeSpokenLines(entries, locales, badges);
  addText(entries, resolve(locales, 'voice-check.sentence'), 'voice-check');

  // Empty today; kept so a future unbounded template can log itself.
  const skipped: SkippedTemplate[] = [];

  return {
    entries: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)),
    skipped,
  };
}
