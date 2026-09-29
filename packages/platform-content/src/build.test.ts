import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContent, exitOnContentError } from './build.ts';
import { compileAll } from './compile-all.ts';
import { ContentError } from './load.ts';
import {
  dir,
  fixturesAfterEach,
  fixturesBeforeEach,
  fixtureSubject,
  writeFullContent,
} from './testing/fixture-subject.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

/** Reads and parses one JSON file under `path`. */
function readJson(...path: readonly string[]): unknown {
  return JSON.parse(readFileSync(join(...path), 'utf8'));
}

describe('compileAll', () => {
  it("compiles a subject's whole content root", () => {
    writeFullContent();

    const compiled = compileAll(fixtureSubject, dir);

    expect(compiled.content.lessons.map((lesson) => lesson.id)).toEqual(['demo-lesson']);
    expect(compiled.content.minigames.map((game) => game.id)).toEqual(['mg1']);
    expect(compiled.tracks.tracks.map((track) => track.id)).toEqual(['basics']);
    expect(compiled.badges.map((badge) => badge.id)).toEqual(['fixture-stars']);
    expect(compiled.voiceTexts.entries.length).toBeGreaterThan(0);
  });

  it("merges the platform's locales with the subject's", () => {
    writeFullContent();

    const { en } = compileAll(fixtureSubject, dir).locales;

    expect(en?.lessons).toMatchObject({ 'demo-lesson': { title: 'Title' } });
    expect(en?.journey).toMatchObject({ tracks: { basics: 'Basics' } });
    expect(en?.rewards).toMatchObject({ badges: { 'fixture-stars': { name: 'Stars' } } });
  });

  it("builds the subject's extra outputs from the root", () => {
    writeFullContent();

    expect(compileAll(fixtureSubject, dir).extraOutputs).toEqual({ 'extra.json': { root: dir } });
  });

  it('reports a missing source file as a content error', () => {
    writeFullContent();
    rmSync(join(dir, 'tracks.yaml'));

    expect(() => compileAll(fixtureSubject, dir)).toThrow(/tracks\.yaml: cannot read file/);
  });
});

describe('buildContent', () => {
  it('writes every output file, equal to the compiled values', async () => {
    writeFullContent();
    const out = join(dir, 'dist');

    const compiled = await buildContent({ subject: fixtureSubject, root: dir, out });

    expect(readJson(out, 'content.json')).toEqual(compiled.content);
    expect(readJson(out, 'tracks.json')).toEqual(compiled.tracks);
    expect(readJson(out, 'badges.json')).toEqual(compiled.badges);
    expect(readJson(out, 'extra.json')).toEqual({ root: dir });
    expect(readJson(out, 'locales', 'en.json')).toEqual(compiled.locales.en);
    expect(readJson(out, 'voice-texts.json')).toEqual(
      compiled.voiceTexts.entries.map(({ key, text, source }) => ({ key, text, source })),
    );
  });

  it("replaces the previous run's locale files", async () => {
    writeFullContent();
    const out = join(dir, 'dist');
    mkdirSync(join(out, 'locales'), { recursive: true });
    writeFileSync(join(out, 'locales', 'stale.json'), '{}');

    await buildContent({ subject: fixtureSubject, root: dir, out });

    expect(existsSync(join(out, 'locales', 'stale.json'))).toBe(false);
    expect(existsSync(join(out, 'locales', 'en.json'))).toBe(true);
  });

  it('writes nothing when the content is invalid', async () => {
    writeFullContent();
    writeFileSync(join(dir, 'badges.yaml'), 'badges: []\n');
    const out = join(dir, 'dist');

    await expect(buildContent({ subject: fixtureSubject, root: dir, out })).rejects.toThrow(
      ContentError,
    );
    expect(existsSync(out)).toBe(false);
  });
});

describe('exitOnContentError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints every issue and exits 1 on a content error', () => {
    const print = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit called');
    });

    expect(() => exitOnContentError(new ContentError(['a: bad', 'b: worse']))).toThrow(
      'exit called',
    );

    expect(print.mock.calls).toEqual([['a: bad'], ['b: worse']]);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('rethrows anything else', () => {
    expect(() => exitOnContentError(new Error('boom'))).toThrow('boom');
  });
});
