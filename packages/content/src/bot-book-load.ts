import { readFileSync } from 'node:fs';
import { bot, chessJsRules, parseFen } from '@chess-kids/core';
import { parse as parseYaml } from 'yaml';
import { ContentError } from './load.ts';
import { botBookFileSchema, type BookLineYaml } from './bot-book-schema.ts';

/** Standard starting position (castling rights included) — every book line is authored from here. */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** First line of an error's message, for compact single-line issue reporting. */
function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

/**
 * Checks one line's moves are all legal, in order, from the standard start position, and within
 * the book's own ply cap — the build-time half of "build validates every line is legal"
 * (`docs/computer-opponent.md` §3). Also rejects a move whose authored SAN does not match
 * chess.js's own SAN for it (e.g. a missing disambiguator): `bookCandidates` (`domain/bot/book.ts`)
 * matches by exact SAN string, so a line like that would silently never match at runtime.
 */
function validateLine(line: BookLineYaml, issues: string[]): void {
  const where = `bot-book.yaml: lines.${line.name}`;
  if (line.moves.length > bot.MAX_BOOK_PLIES) {
    issues.push(
      `${where}: ${String(line.moves.length)} plies, more than the ${String(bot.MAX_BOOK_PLIES)}-ply cap`,
    );
  }
  let position = parseFen(START_FEN);
  for (const [index, san] of line.moves.entries()) {
    const played = chessJsRules.play(position, san);
    if (played === null) {
      const soFar = line.moves.slice(0, index).join(' ') || 'the start position';
      issues.push(`${where}: move ${String(index + 1)} ("${san}") is illegal after ${soFar}`);
      return;
    }
    if (played.move.san !== san) {
      issues.push(
        `${where}: move ${String(index + 1)} written as "${san}" but chess.js's own SAN for it ` +
          `is "${played.move.san}" — book lookups match by exact SAN, so this line would never ` +
          'match at runtime',
      );
      return;
    }
    position = played.position;
  }
}

/**
 * Loads and validates `bot-book.yaml` (`docs/computer-opponent.md` §3: Fox/Wolf/Bear's small
 * opening book), compiling it to `bot.BotBook`. Deliberately its own module, not part of
 * `lesson-load.ts` — this file's own content, own validation, own build step (see `build.ts`).
 */
export function loadBotBook(filePath: string): bot.BotBook {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ContentError([`bot-book.yaml: cannot read file: ${errorMessage(error)}`]);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw, { uniqueKeys: true });
  } catch (error) {
    throw new ContentError([`bot-book.yaml: YAML syntax error: ${errorMessage(error)}`]);
  }

  const result = botBookFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContentError(
      result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `bot-book.yaml: ${path}: ${issue.message}`;
      }),
    );
  }

  const issues: string[] = [];
  const seenNames = new Set<string>();
  for (const line of result.data.lines) {
    if (seenNames.has(line.name)) {
      issues.push(`bot-book.yaml: lines.${line.name}: duplicate line name`);
    }
    seenNames.add(line.name);
    validateLine(line, issues);
  }
  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return {
    lines: result.data.lines.map((line) => ({ name: line.name, moves: line.moves })),
  };
}
