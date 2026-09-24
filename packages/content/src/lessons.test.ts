import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaptureDef } from '@chess-kids/core';
import { chessJsRules, createVariantRules, optimalMoves } from '@chess-kids/core';
import { describe, expect, it } from 'vitest';
import { loadLocales } from './load.ts';
import { loadContent } from './lesson-load.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = loadLocales(join(packageDir, 'locales'));
const content = loadContent(join(packageDir, 'lessons'), join(packageDir, 'minigames'), locales);
const rules = createVariantRules(chessJsRules);

describe('real content', () => {
  it('loads with no issues (loadContent above did not throw) and has the expected shape', () => {
    expect(content.version).toBe(1);
    expect(content.lessons.length).toBeGreaterThan(0);
    expect(content.minigames.length).toBeGreaterThan(0);
  });

  it('has the rook lesson with 2 guided tries and 8 rising-difficulty exercises', () => {
    const rook = content.lessons.find((lesson) => lesson.id === 'rook');
    if (rook === undefined) {
      throw new Error('rook lesson not found');
    }

    expect(rook.world).toBe('pieces');
    expect(rook.order).toBe(1);
    expect(rook.concept).toBe('rook-move');
    expect(rook.character).toBe('rhino');
    expect(rook.guided).toHaveLength(2);
    expect(rook.exercises).toHaveLength(8);
    expect(rook.exercises.map((exercise) => exercise.type)).toEqual([
      'collect-stars',
      'collect-stars',
      'select-squares',
      'collect-stars',
      'capture',
      'select-squares',
      'capture',
      'collect-stars',
    ]);
    expect(rook.boss).toBe('hungry-rook');
  });

  it('every collect-stars / capture exercise (guided and scored) is solvable at its stars3', () => {
    for (const lesson of content.lessons) {
      for (const exercise of [...lesson.guided, ...lesson.exercises]) {
        if (exercise.type === 'select-squares') {
          continue;
        }
        expect(optimalMoves(exercise, rules)).toBe(exercise.stars3);
        expect(exercise.stars2).toBeGreaterThanOrEqual(exercise.stars3);
      }
    }
  });

  it('every exercise position has a piece for the side to move', () => {
    for (const lesson of content.lessons) {
      for (const exercise of [...lesson.guided, ...lesson.exercises]) {
        const hasKidPiece = Object.values(exercise.position.pieces).some(
          (piece) => piece.color === exercise.position.toMove,
        );
        expect(hasKidPiece).toBe(true);
      }
    }
  });

  it('Hungry Rook par equals its optimal solve and unlocks after the rook lesson', () => {
    const hungryRook = content.minigames.find((minigame) => minigame.id === 'hungry-rook');
    if (hungryRook === undefined) {
      throw new Error('hungry-rook mini-game not found');
    }

    expect(hungryRook.unlockAfter).toBe('rook');
    expect(hungryRook.moveLimit).toBeGreaterThan(hungryRook.par);

    const asCapture: CaptureDef = {
      id: hungryRook.id,
      concept: hungryRook.concept,
      textKey: hungryRook.titleKey,
      position: hungryRook.position,
      type: 'capture',
      stars3: hungryRook.par,
      stars2: hungryRook.par,
    };
    expect(optimalMoves(asCapture, rules)).toBe(hungryRook.par);
  });
});
