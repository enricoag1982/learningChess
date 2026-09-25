#!/usr/bin/env python3
"""Derive `lioness.webp` (queen) from the Fluent Emoji 3D lion image (king).

There is no Fluent Emoji lioness, so the queen is the lion face (`1f981`) without its mane. The
mane is every non-face pixel (face, ears and muzzle are bright: red channel >= 200) connected to
the image border: a flood fill from the border removes it, while the dark eyes and nose survive
because the face encloses them. Pixels within 3 px of the cut fade out by brightness, so the
brownish rim goes soft instead of jagged.

Run once, offline, from the repo root (any Python 3 + Pillow):
    python3 tools/art/make-lioness.py
Commit the output `apps/web/src/assets/art/lioness.webp`; not part of the build.
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE = REPO_ROOT / "apps/web/src/assets/art/lion.webp"
DEST = REPO_ROOT / "apps/web/src/assets/art/lioness.webp"

FACE_MIN_RED = 200  # face / ears / muzzle are at least this red; mane and background are not
RIM_FULL_RED = 235  # rim pixels at least this red stay fully opaque
RIM_PX = 3


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    width, height = src.size
    px = src.load()

    removed = Image.new("L", (width, height), 0)
    rm = removed.load()
    queue = deque()
    for x in range(width):
        queue.extend([(x, 0), (x, height - 1)])
    for y in range(height):
        queue.extend([(0, y), (width - 1, y)])
    while queue:
        x, y = queue.popleft()
        if rm[x, y]:
            continue
        red, _green, _blue, alpha = px[x, y]
        if alpha >= 128 and red >= FACE_MIN_RED:
            continue
        rm[x, y] = 255
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and not rm[nx, ny]:
                queue.append((nx, ny))

    near_cut = removed.filter(ImageFilter.MaxFilter(2 * RIM_PX + 1)).load()
    mask = Image.new("L", (width, height), 0)
    m = mask.load()
    for x in range(width):
        for y in range(height):
            if rm[x, y]:
                continue
            red, _green, _blue, alpha = px[x, y]
            if red >= RIM_FULL_RED or not near_cut[x, y]:
                m[x, y] = alpha
            else:
                fade = max(0.0, (red - FACE_MIN_RED) / (RIM_FULL_RED - FACE_MIN_RED))
                m[x, y] = int(alpha * fade)

    out = src.copy()
    out.putalpha(mask.filter(ImageFilter.GaussianBlur(0.6)))
    out.save(DEST, "WEBP", quality=90, method=6)
    print(f"wrote {DEST.relative_to(REPO_ROOT)} ({DEST.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
