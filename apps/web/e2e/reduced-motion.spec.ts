import { expect, test } from '@playwright/test';
import { clickSquare, startLessonToFirstGuided } from './helpers.ts';

// non-functional.md §2: "Respect reduce motion." index.css zeroes animation/transition durations
// globally under `prefers-reduced-motion: reduce`, so a played move should land immediately
// instead of visibly sliding.
test.use({ reducedMotion: 'reduce' });

test('a move lands on its square immediately, with no hanging slide animation', async ({
  page,
}) => {
  // The Rook lesson's first guided try: rook d1 -> star d5, a single straight-line move.
  await startLessonToFirstGuided(page);
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd5');

  // The un-reduced slide animation runs 180ms (board.css); this wait is well under that, so if
  // reduced motion were *not* applied the piece would still visibly be mid-slide here.
  await page.waitForTimeout(60);

  const destination = page.getByRole('button', { name: /^d5, white rook/ });
  const squareBox = await destination.boundingBox();
  const pieceBox = await destination.locator('span[aria-hidden="true"]').first().boundingBox();
  expect(squareBox).not.toBeNull();
  expect(pieceBox).not.toBeNull();
  if (!squareBox || !pieceBox) return;

  // The piece is centred on its square, not offset by a stale `translate()` from the slide.
  const squareCenterX = squareBox.x + squareBox.width / 2;
  const pieceCenterX = pieceBox.x + pieceBox.width / 2;
  expect(Math.abs(pieceCenterX - squareCenterX)).toBeLessThan(squareBox.width * 0.2);
});
