import type { Move, MoveInput } from '../chess/rules.ts';
import type { Position, Square } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';

/** Result of playing one kid move against a static opponent. */
export interface AppliedMove {
  readonly position: Position;
  readonly move: Move;
  /** Star squares collected by landing on them with this move (0 or 1: only landing counts). */
  readonly collected: readonly Square[];
}

/**
 * Plays one kid move (opponent stays put) and collects any star the move lands on. Shared by the
 * exercise engine and the solver so both apply exactly the same star-collection rule.
 */
export function applyKidMove(
  position: Position,
  rules: VariantRules,
  move: MoveInput,
): AppliedMove | null {
  const played = rules.play(position, { staticOpponent: true }, move);
  if (played === null) {
    return null;
  }
  const collected = position.markers.stars.includes(played.move.to) ? [played.move.to] : [];
  const resultPosition =
    collected.length > 0
      ? {
          ...played.position,
          markers: {
            ...played.position.markers,
            stars: played.position.markers.stars.filter((star) => star !== played.move.to),
          },
        }
      : played.position;
  return { position: resultPosition, move: played.move, collected };
}
