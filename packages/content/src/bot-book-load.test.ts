import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadBotBook } from './bot-book-load.ts';
import { ContentError } from './load.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chess-kids-bot-book-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(content: string): string {
  const filePath = join(dir, 'bot-book.yaml');
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/** Loads `content` (written to a temp `bot-book.yaml`), returning issues instead of throwing. */
function loadIssues(content: string): string[] {
  try {
    loadBotBook(write(content));
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}

const VALID = `
lines:
  - name: e4-italian
    moves: [e4, e5, Nf3, Nc6, Bc4, Bc5]
  - name: d4-slav
    moves: [d4, d5, c4, c6]
`;

describe('loadBotBook', () => {
  it('compiles a valid file to a BotBook', () => {
    const book = loadBotBook(write(VALID));
    expect(book.lines).toEqual([
      { name: 'e4-italian', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
      { name: 'd4-slav', moves: ['d4', 'd5', 'c4', 'c6'] },
    ]);
  });

  it('reports an illegal move', () => {
    // "Nf6" is White's 2nd move here — no white knight can reach f6 from b1 or g1 in one move.
    const issues = loadIssues(`
lines:
  - name: bad
    moves: [e4, e5, Nf6]
`);
    expect(issues).toEqual([expect.stringContaining('bad: move 3 ("Nf6") is illegal')]);
  });

  it('reports a line past the 6-ply cap', () => {
    const issues = loadIssues(`
lines:
  - name: too-long
    moves: [e4, e5, Nf3, Nc6, Bc4, Bc5, Nf3]
`);
    expect(issues.some((issue) => issue.includes('more than the 6-ply cap'))).toBe(true);
  });

  it('reports a duplicate line name', () => {
    const issues = loadIssues(`
lines:
  - name: e4-italian
    moves: [e4, e5]
  - name: e4-italian
    moves: [d4, d5]
`);
    expect(issues).toEqual([expect.stringContaining('duplicate line name')]);
  });

  it('reports a SAN that does not match chess.js’s own notation', () => {
    // Two knights could reach f3 disambiguation aside, "Nf3" is correct SAN here — but a typo'd
    // capture marker ("Nxf3" with nothing on f3) is not: chess.js accepts the from/to, but its own
    // SAN for the move ("Nf3", no "x") differs from what was authored.
    const issues = loadIssues(`
lines:
  - name: bad-san
    moves: [e4, e5, Nxf3]
`);
    expect(issues.some((issue) => issue.includes('bad-san'))).toBe(true);
  });

  it('rejects an empty lines list', () => {
    const issues = loadIssues('lines: []');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('throws for a missing file', () => {
    expect(() => loadBotBook(join(dir, 'missing.yaml'))).toThrow(ContentError);
  });

  it('throws for invalid YAML syntax', () => {
    const issues = loadIssues('lines: [');
    expect(issues.length).toBeGreaterThan(0);
  });
});
