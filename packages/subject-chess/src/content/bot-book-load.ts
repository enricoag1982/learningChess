import { bot } from '../chess.ts';
import { chessJsRules } from '../core/chess/chessjs-rules.ts';
import { parseFen } from '../core/chess/fen.ts';
import { ContentError } from '@learn/platform-content/load';
import { loadYaml } from '@learn/platform-content/yaml-file';
import { botBookFileSchema, type BookLineYaml } from './bot-book-schema.ts';

/** Standard starting position (castling rights included) — every book line is authored from here. */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Checks one line's moves are all legal, in order, from the standard start position, and within
 * the book's ply cap. Also rejects a move whose authored SAN does not match chess.js's own —
 * `bookCandidates` matches by exact SAN string, so a mismatch would never match at runtime. */
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

/** Loads and validates `bot-book.yaml` (Fox/Wolf/Bear's small opening book), compiling it to
 * `bot.BotBook`. Deliberately its own module, not part of `lesson-load.ts`. */
export function loadBotBook(filePath: string): bot.BotBook {
  const loaded = loadYaml(filePath, 'bot-book.yaml', botBookFileSchema);
  if ('issues' in loaded) {
    throw new ContentError(loaded.issues);
  }

  const issues: string[] = [];
  const seenNames = new Set<string>();
  for (const line of loaded.data.lines) {
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
    lines: loaded.data.lines.map((line) => ({ name: line.name, moves: line.moves })),
  };
}
