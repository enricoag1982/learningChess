import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { voiceKey } from '@chess-kids/core';
import { describe, expect, it } from 'vitest';
import { loadBadges } from './badges-load.ts';
import { loadLocales, type Locales } from './load.ts';
import { loadContent } from './lesson-load.ts';
import type { LocaleTree } from './schema.ts';
import { loadTracks } from './tracks-load.ts';
import { buildVoiceInventory } from './voice-texts.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = loadLocales(join(packageDir, 'locales'));
const content = loadContent(join(packageDir, 'lessons'), join(packageDir, 'minigames'), locales);
const catalog = loadTracks(
  join(packageDir, 'tracks.yaml'),
  locales,
  content.minigames,
  content.lessons,
);
const badges = loadBadges(
  join(packageDir, 'badges.yaml'),
  locales,
  catalog,
  content.lessons,
  content.minigames,
);

const inventory = buildVoiceInventory(locales, content, catalog, badges);
const textsBySource = new Map<string, string[]>();
for (const entry of inventory.entries) {
  const list = textsBySource.get(entry.source) ?? [];
  list.push(entry.text);
  textsBySource.set(entry.source, list);
}

/** Looks up a dot-separated `namespace:path` key directly against `locales.en`, mirroring
 * `voice-texts.ts`'s own private resolver — used only to independently recompute the expected text
 * for the "every lesson story/demo is present" assertions below. */
function lookupLocale(loc: Locales, fullKey: string): string {
  const separatorIndex = fullKey.indexOf(':');
  const namespace = separatorIndex < 0 ? 'common' : fullKey.slice(0, separatorIndex);
  const dotPath = separatorIndex < 0 ? fullKey : fullKey.slice(separatorIndex + 1);
  let node: LocaleTree | string | undefined = loc.en?.[namespace];
  for (const segment of dotPath.split('.')) {
    if (node === undefined || typeof node === 'string') break;
    node = node[segment];
  }
  if (typeof node !== 'string') {
    throw new Error(`test lookup failed for ${fullKey}`);
  }
  return node;
}

describe('voice text inventory (real content)', () => {
  it('has every lesson story and demo text (one per lesson; every story is unique already)', () => {
    // Story keys resolve 1:1 to a unique English sentence per lesson (checked directly, not via
    // the inventory, since two lessons happening to share one exercise wording — unlike story —
    // would otherwise mask a real miss through dedup); demo text is compared the same way.
    expect(textsBySource.get('lesson-story')).toHaveLength(content.lessons.length);
    expect(textsBySource.get('lesson-demo')).toHaveLength(content.lessons.length);
    for (const lesson of content.lessons) {
      const story = lookupLocale(locales, lesson.storyKey);
      const demo = lookupLocale(locales, lesson.demo.textKey);
      expect(inventory.entries.some((entry) => entry.text === story)).toBe(true);
      expect(inventory.entries.some((entry) => entry.text === demo)).toBe(true);
    }
  });

  it('has every scored/guided exercise instruction text (deduped by wording, not lost)', () => {
    const wordings = new Set<string>();
    for (const lesson of content.lessons) {
      for (const def of [...lesson.guided, ...lesson.exercises]) {
        wordings.add(lookupLocale(locales, def.textKey));
      }
    }
    // Every wording is present *somewhere* in the inventory — usually under lesson-guided/
    // lesson-exercise, but a wording a mini-game round happens to share verbatim (e.g. "Tap every
    // square in your king's row.") dedupes to one audio file and keeps whichever source label
    // last touched that key; the label is report-only, so that reassignment is not a loss.
    const allTexts = new Set(inventory.entries.map((entry) => entry.text));
    for (const wording of wordings) {
      expect(allTexts.has(wording)).toBe(true);
    }
  });

  it('has every mini-game goal text', () => {
    expect(textsBySource.get('minigame-goal')).toHaveLength(content.minigames.length);
  });

  it('contains no parent-area / password / backup / privacy text', () => {
    const forbidden = ['parent.', 'new-player.', 'backup.', 'privacy.'];
    for (const entry of inventory.entries) {
      for (const prefix of forbidden) {
        expect(entry.source.startsWith(prefix)).toBe(false);
      }
    }
    // Confirms the guard is meaningful: real parent-area content does exist in the locale (it is
    // simply never resolved into the inventory), not vacuously true because the namespace is empty.
    expect(locales.en?.common?.['parent']).toBeDefined();
  });

  it('every expansion stays well under the 200-per-template skip threshold', () => {
    for (const [source, texts] of textsBySource) {
      expect(texts.length, `source "${source}" has ${String(texts.length)} entries`).toBeLessThan(
        200,
      );
    }
  });

  it('keys are unique and derived from voiceKey(text)', () => {
    const keys = inventory.entries.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of inventory.entries) {
      expect(entry.key).toBe(voiceKey(entry.text));
    }
  });

  it('nothing is skipped (M6.3: every exercise note text is now inventoried on its own)', () => {
    expect(inventory.skipped).toEqual([]);
  });

  it('has every exercise note shape (M6.3 item 1: instruction and note are spoken separately)', () => {
    const notes = textsBySource.get('exercise-note') ?? [];
    expect(notes).toContain('Not quite! Try again.'); // exercise.answer-wrong
    expect(notes).toContain('Amazing!'); // exercise.praise-3
    expect(notes).toContain('Here is the answer.'); // exercise.hint-answer, shared across every kind
    expect(notes).toContain('Checkmate! Amazing!'); // checkmate + praise-3 concatenation
    for (const lesson of content.lessons) {
      const name = lookupLocale(locales, `characters:${lesson.character}.name`);
      expect(notes.some((text) => text.includes(name))).toBe(true);
    }

    const withOffer = textsBySource.get('exercise-note-easier-offer') ?? [];
    expect(withOffer.length).toBeGreaterThan(0);
    for (const text of withOffer) {
      expect(text.endsWith('This one is tricky. Want an easier one?')).toBe(true);
    }
    // The offer never appends to a hint/praise/checkmate/opponent-reply note.
    expect(withOffer.some((text) => text.includes('Amazing!'))).toBe(false);
  });

  it('is deterministic across runs (same content in, same inventory out)', () => {
    const again = buildVoiceInventory(locales, content, catalog, badges);
    expect(again.entries).toEqual(inventory.entries);
  });
});
