// The whole content build of one subject: compiles it and writes every `dist/` file.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileAll, type CompiledAll } from './compile-all.ts';
import { ContentError } from './load.ts';
import type { SubjectContent } from './subject.ts';

export interface BuildOptions {
  readonly subject: SubjectContent;
  /** Source root: `locales/`, `lessons/`, `minigames/`, `tracks.yaml`, `badges.yaml`, … */
  readonly root: string;
  /** Output dir: `content.json`, `tracks.json`, `badges.json`, `voice-texts.json`, extra files, `locales/<lang>.json`. */
  readonly out: string;
}

export async function buildContent({ subject, root, out }: BuildOptions): Promise<CompiledAll> {
  const compiled = compileAll(subject, root);
  const { locales, content, tracks, badges, extraOutputs, voiceTexts } = compiled;

  const localesDir = join(out, 'locales');
  await rm(localesDir, { recursive: true, force: true });
  await mkdir(localesDir, { recursive: true });
  for (const [lang, namespaces] of Object.entries(locales)) {
    await writeFile(join(localesDir, `${lang}.json`), JSON.stringify(namespaces), 'utf8');
  }

  const files: Readonly<Record<string, unknown>> = {
    'content.json': content,
    'tracks.json': tracks,
    'badges.json': badges,
    ...extraOutputs,
    'voice-texts.json': voiceTexts.entries.map(({ key, text, source }) => ({ key, text, source })),
  };
  for (const [name, value] of Object.entries(files)) {
    await writeFile(join(out, name), JSON.stringify(value), 'utf8');
  }

  console.log(
    `content: ${String(Object.keys(locales).length)} language(s), ` +
      `${String(content.lessons.length)} lesson(s), ${String(content.minigames.length)} mini-game(s), ` +
      `${String(tracks.tracks.length)} track(s), ${String(tracks.ranks.length)} rank(s), ` +
      `${String(badges.length)} badge(s), ${String(voiceTexts.entries.length)} voice text(s) → ${out}`,
  );
  return compiled;
}

/** For build scripts: a `ContentError` prints every issue and exits 1; anything else rethrows. */
export function exitOnContentError(error: unknown): never {
  if (error instanceof ContentError) {
    for (const issue of error.issues) {
      console.error(issue);
    }
    process.exit(1);
  }
  throw error;
}
