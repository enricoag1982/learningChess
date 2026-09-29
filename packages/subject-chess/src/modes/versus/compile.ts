import type { VersusMiniGame } from '../../core/chess/lesson.ts';
import type { Color, Piece, Square } from '../../core/chess/types.ts';
import { game } from '../../chess.ts';
import type { z } from 'zod';
import { compilePosition } from '../../content/kinds/common.ts';
import type { MiniGameCompileContext } from '@learn/platform-content/modes/mode-content';
import type { schema, WinConditionYaml } from './schema.ts';

function compileWinCondition(raw: WinConditionYaml): game.WinCondition {
  if (typeof raw === 'string') {
    return { kind: raw };
  }
  if ('capture' in raw) {
    return { kind: 'capture', piece: raw.capture as Piece['type'] };
  }
  if ('reach' in raw) {
    return { kind: 'reach', squares: raw.reach as readonly Square[] };
  }
  return { kind: 'survive', moves: raw.survive };
}

/** Authored `rules` (kid / opponent win lists) → `GameRulesDef` by `kidColor`; `checkRules` derives from `kings` (check / mate /
 * stalemate only when both kings exist, `domain-model.md` §1.4). */
function compileVersusRules(
  raw: z.output<typeof schema>['rules'],
  kidColor: Color,
  moveLimit: number | undefined,
): game.GameRulesDef {
  const kidWin = raw.win.kid.map(compileWinCondition);
  const opponentWin = raw.win.opponent.map(compileWinCondition);
  const win = kidColor === 'w' ? { w: kidWin, b: opponentWin } : { w: opponentWin, b: kidWin };
  return {
    kings: raw.kings,
    checkRules: raw.kings,
    noMoves: raw.noMoves,
    win,
    ...(moveLimit === undefined ? {} : { moveLimit }),
  };
}

export function compile(
  raw: z.output<typeof schema>,
  ctx: MiniGameCompileContext,
): VersusMiniGame | null {
  const position = compilePosition(raw, { where: `${ctx.relPath}: board`, issues: ctx.issues });
  if (position === null) {
    return null;
  }
  const kidColor = raw.kidColor ?? 'w';
  return {
    mode: 'versus',
    id: raw.id,
    concept: raw.concept,
    rules: compileVersusRules(raw.rules, kidColor, raw.moveLimit),
    position,
    opponentLevel: raw.opponent.bot as 1 | 2 | 3 | 4 | 5,
    kidColor,
    ...(raw.par === undefined ? {} : { par: raw.par }),
    titleKey: `lessons:${raw.title ?? `${raw.id}.title`}`,
    goalKey: `lessons:${raw.goal ?? `${raw.id}.goal`}`,
    unlockAfter: raw.unlockAfter,
  };
}
