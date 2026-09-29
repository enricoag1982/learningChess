import { bot } from '../chess.ts';
import { chessJsRules } from '../core/chess/chessjs-rules.ts';
import { parseFen } from '../core/chess/fen.ts';
import { ContentError } from '@learn/platform-content/load';
import { loadYaml } from '@learn/platform-content/yaml-file';
import { botBookFileSchema, type BookLineYaml } from './bot-book-schema.ts';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Every move legal in order from the start position and within the ply cap; also rejects a SAN differing from chess.js's own
 * (`bookCandidates` matches exact SAN strings). */
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

/** Loads and validates `bot-book.yaml` (Fox/Wolf/Bear's opening book) into `bot.BotBook`; its own module, not part of `lesson-load.ts`. */
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
