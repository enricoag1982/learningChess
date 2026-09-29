import { join } from 'node:path';
import type { BadgeDef, CompiledContent, TracksCatalog } from '@learn/platform-core';
import { loadBadges } from './badges-load.ts';
import {
  ContentError,
  compareToReference,
  loadLocales,
  mergeLocales,
  type Locales,
} from './load.ts';
import { loadContent } from './lesson-load.ts';
import type { SubjectContent } from './subject.ts';
import { loadTracks } from './tracks-load.ts';
import { buildVoiceInventory, type VoiceInventory } from './voice-texts.ts';
import { PLATFORM_LOCALES_DIR } from './paths.ts';

/** Every value `buildContent` writes to `dist/`, computed once; `C` is the subject's concrete content bundle, inferred like
 * `loadContent`'s. */
export interface CompiledAll<C extends CompiledContent = CompiledContent> {
  readonly locales: Locales;
  readonly content: C;
  readonly tracks: TracksCatalog;
  readonly extraOutputs: Readonly<Record<string, unknown>>;
  readonly badges: readonly BadgeDef[];
  /** `dist/voice-texts.json`'s own source (`buildContent` writes just its `entries`). */
  readonly voiceTexts: VoiceInventory;
}

export function compileAll<C extends CompiledContent = CompiledContent>(
  subject: SubjectContent,
  root: string,
): CompiledAll<C> {
  const locales = mergeLocales(
    loadLocales(PLATFORM_LOCALES_DIR),
    loadLocales(join(root, 'locales')),
  );

  const referenceIssues = compareToReference(locales);
  if (referenceIssues.length > 0) {
    throw new ContentError(referenceIssues);
  }

  const content = loadContent<C>(join(root, 'lessons'), join(root, 'minigames'), locales, subject);
  const tracks = loadTracks(join(root, 'tracks.yaml'), locales, content.minigames, content.lessons);
  const extraOutputs = Object.fromEntries(
    Object.entries(subject.extraOutputs ?? {}).map(([name, build]) => [name, build(root)]),
  );
  const badges = loadBadges(
    join(root, 'badges.yaml'),
    locales,
    tracks,
    content.lessons,
    content.minigames,
    subject.badges,
  );
  const voiceTexts = buildVoiceInventory(locales, content, tracks, badges, subject);

  return { locales, content, tracks, extraOutputs, badges, voiceTexts };
}
