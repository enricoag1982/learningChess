import type { JSX } from 'react';
import type { Color, PieceType } from '@chess-kids/core';
import { characterColor, characterForPiece } from '../art/character-meta.ts';
import { CharacterIcon } from '../art/characters.tsx';

/** A drawable piece: its type and colour. */
export interface PieceIconProps {
  readonly piece: { readonly color: Color; readonly type: PieceType };
  /** Fixed rendered width/height in CSS pixels. Omit to fill the parent (the board's own squares). */
  readonly size?: number;
}

const PALETTE = {
  w: { fill: '#FFFFFF', stroke: '#22313A', detail: 'none' },
  b: { fill: '#2B2F36', stroke: '#111418', detail: 'rgba(255,255,255,0.45)' },
} as const;

const STROKE_WIDTH = 2;

/** Rounded base every piece stands on (chunky: ~31 wide, sits at the very bottom of the viewBox). */
function Base(): JSX.Element {
  return <rect x={7} y={37} width={31} height={5} rx={2.5} />;
}

function Pawn(): JSX.Element {
  return (
    <>
      <Base />
      <path d="M12.5,38 C11,28.5 14,21.5 22.5,17.5 C31,21.5 34,28.5 32.5,38 Z" />
      <circle cx={22.5} cy={11.5} r={7.5} />
    </>
  );
}

function Rook(): JSX.Element {
  return (
    <>
      <Base />
      <rect x={10} y={19} width={25} height={19} rx={2} />
      <rect x={9.5} y={15.5} width={26} height={5.5} rx={1.5} />
      <rect x={9.5} y={5} width={7} height={11} rx={1.8} />
      <rect x={19} y={5} width={7} height={11} rx={1.8} />
      <rect x={28.5} y={5} width={7} height={11} rx={1.8} />
    </>
  );
}

function Bishop({ color }: { readonly color: Color }): JSX.Element {
  // The mitre slit is a single diagonal chord cut across the ball: dark line on white, pale on
  // black. It must never cross another drawn line, or it reads as an X.
  const slitStroke = color === 'w' ? PALETTE.w.stroke : PALETTE.b.detail;
  return (
    <>
      <Base />
      <path d="M13,38 C11,28 13.5,21 18,17.5 C15.5,15 15.5,11.5 18.5,9.5 L26.5,9.5 C29.5,11.5 29.5,15 27,17.5 C31.5,21 34,28 32,38 Z" />
      <circle cx={22.5} cy={6.5} r={3.6} />
      <path
        d="M19.5,8 L25,4.3"
        fill="none"
        stroke={slitStroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </>
  );
}

function Knight({ color }: { readonly color: Color }): JSX.Element {
  // Eye/nostril/mane read as marks cut into the fill, so they show on both colours: dark ink on
  // white, a pale line on black.
  const markStroke = color === 'w' ? PALETTE.w.stroke : PALETTE.b.detail;
  return (
    <>
      <Base />
      {/* Horse head + neck in profile, facing left: a separate pointed ear sits on the poll; the
          head/neck silhouette reads (front to back) a long, slightly convex nose bridge down to
          a sharp muzzle point, a straight mouth edge back to the jaw, a concave throat notch (the
          classic knight "waist"), a convex chest down to the base, then a convex mane-side neck
          arching back up to the poll. */}
      <path
        d="M23,7
           C26,7.5 29,9.5 31.5,13
           C34,16.5 35,20 35,24
           C35,27.5 34.5,31 34,34
           C33.8,35.5 34,36.8 34,38
           L22,38
           C20,34 18,31 17,27
           C17,24 15,21.5 12,23
           L7,19.5
           L2,16
           C5,12.5 9,9.5 14,7.5
           C15.5,6.5 17,6 18.5,5.5
           C20,4 21.5,4.5 23,7
           Z"
      />
      {/* pointed ear, on top of the poll */}
      <path d="M18.5,6.5 C16.8,3 20,0.5 23,3 C24,5 22.5,7.8 19.5,8.8 Z" />
      {/* eye */}
      <circle cx={11} cy={9} r={1.8} fill={markStroke} stroke="none" />
      {/* nostril, near the muzzle tip */}
      <circle cx={4.5} cy={16.5} r={1.2} fill={markStroke} stroke="none" />
      {/* mouth line, from the muzzle tip back to the jaw corner */}
      <path
        d="M5,18.5 L9,20.8"
        fill="none"
        stroke={markStroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* mane ridge along the back of the neck */}
      <path
        d="M28,10 L25,11"
        fill="none"
        stroke={markStroke}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <path
        d="M32,14.5 L29,16"
        fill="none"
        stroke={markStroke}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <path
        d="M34.5,20 L31.5,21.5"
        fill="none"
        stroke={markStroke}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <path
        d="M34.5,27 L31,28.5"
        fill="none"
        stroke={markStroke}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </>
  );
}

function Queen({ color }: { readonly color: Color }): JSX.Element {
  // The band under the crown is a shadow cut into the fill: dark on white, pale on black.
  const bandFill = color === 'w' ? PALETTE.w.stroke : PALETTE.b.detail;
  const bandOpacity = color === 'w' ? 0.35 : 0.55;
  return (
    <>
      <Base />
      <path d="M10.5,38 C8.5,28.5 10.5,22 12.5,18.5 L31.5,18.5 C33.5,22 35.5,28.5 33.5,38 Z" />
      <rect
        x={12.5}
        y={16}
        width={19}
        height={3.2}
        rx={1.6}
        fill={bandFill}
        opacity={bandOpacity}
      />
      {[12.5, 17.4, 22.5, 27.6, 32.5].map((cx, index) => (
        <circle key={cx} cx={cx} cy={9} r={index === 2 ? 3.3 : 2.6} />
      ))}
    </>
  );
}

function King({ color }: { readonly color: Color }): JSX.Element {
  // The band and cross are shadows/emblems cut into the fill: dark on white, pale on black.
  const accentFill = color === 'w' ? PALETTE.w.stroke : PALETTE.b.detail;
  const bandOpacity = color === 'w' ? 0.18 : 0.5;
  return (
    <>
      <Base />
      <path d="M11,38 C9,28 11.5,21 16,17.5 L29,17.5 C33.5,21 36,28 34,38 Z" />
      <rect
        x={15}
        y={15}
        width={15}
        height={5.5}
        rx={1.8}
        fill={accentFill}
        opacity={bandOpacity}
      />
      <rect x={21} y={3} width={3} height={12} rx={1.2} fill={accentFill} />
      <rect x={17} y={6} width={10} height={3} rx={1.2} fill={accentFill} />
    </>
  );
}

const SHAPES: Record<PieceType, (props: { readonly color: Color }) => JSX.Element> = {
  p: Pawn,
  r: Rook,
  b: Bishop,
  n: Knight,
  q: Queen,
  k: King,
};

/** One SVG piece drawing (our own artwork, viewBox 0 0 45 45, `aria-hidden`).
 * With no `size`, it fills its container (for the responsive board); pass `size` for a fixed
 * pixel drawing (e.g. the piece gallery). */
export function PieceIcon({ piece, size }: PieceIconProps): JSX.Element {
  const colours = PALETTE[piece.color];
  const Shape = SHAPES[piece.type];
  return (
    <svg
      viewBox="0 0 45 45"
      aria-hidden="true"
      className={`pointer-events-none block ${size === undefined ? 'h-full w-full' : ''}`}
      {...(size === undefined ? {} : { width: size, height: size })}
    >
      <g
        fill={colours.fill}
        stroke={colours.stroke}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <Shape color={piece.color} />
      </g>
      {piece.color === 'b' && (
        <g fill="none" stroke={colours.detail} strokeWidth={1.3} strokeLinecap="round">
          <ShadeLines type={piece.type} />
        </g>
      )}
    </svg>
  );
}

/**
 * Small animal-face badge overlaid on a piece's corner (docs/app-structure.md "Piece look on
 * board": classic + animal badge in Worlds 1-4). Purely decorative — a square's own accessible
 * name already names the piece by type and colour (`Board`'s `role="grid"` labels) — so it is
 * `aria-hidden`.
 */
export function PieceBadge({ type }: { readonly type: PieceType }): JSX.Element {
  const character = characterForPiece(type);
  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-0.5 -right-0.5 flex h-[40%] w-[40%] items-center justify-center overflow-hidden rounded-full border border-white/80 p-0.5"
      style={{ backgroundColor: characterColor(character) }}
    >
      <CharacterIcon character={character} />
    </span>
  );
}

/** Light inner detail strokes on black pieces, so shape detail stays visible against the dark fill. */
function ShadeLines({ type }: { readonly type: PieceType }): JSX.Element {
  switch (type) {
    case 'p':
      return <path d="M17,33 C17,26.5 19.5,22.5 22.5,20" />;
    case 'r':
      return (
        <>
          <path d="M16,22 L16,35" />
          <path d="M29,22 L29,35" />
        </>
      );
    case 'b':
      return <path d="M17.5,32 C16,23 18,16 22,11" />;
    case 'n':
      return <path d="M15,29 C12,25 9,20 5,17" />;
    case 'q':
      return <path d="M13.5,32 C11.5,24 13,19 15,18.5" />;
    case 'k':
      return <path d="M14,32 C12,24 14,18.5 16,17.5" />;
  }
}

/** Fixed pixel size, or fill the parent when omitted (used inline on a square). */
interface MarkerIconProps {
  readonly size?: number;
}

/** Gold five-point star marker (collectible squares), `aria-hidden`. */
export function StarIcon({ size }: MarkerIconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 45 45"
      aria-hidden="true"
      className={`pointer-events-none block ${size === undefined ? 'h-full w-full' : ''}`}
      {...(size === undefined ? {} : { width: size, height: size })}
    >
      <path
        d="M22.5,5 L32.8,36.7 L5.9,17.1 L39.1,17.1 L12.2,36.7 Z"
        fill="#E9A92B"
        stroke="#8C5E08"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Friendly rock/bush marker for a blocked square, `aria-hidden`. Never a red cross. */
export function BlockedIcon({ size }: MarkerIconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 45 45"
      aria-hidden="true"
      className={`pointer-events-none block ${size === undefined ? 'h-full w-full' : ''}`}
      {...(size === undefined ? {} : { width: size, height: size })}
    >
      <path
        d="M9,32 C6.5,26 9.5,19.5 15.5,17.5 C16.5,12.5 22.5,9.5 28.5,12.5 C34.5,13.5 37.5,19.5 35,25.5 C37.5,29 36,33.5 31.5,35 C24,37.5 14.5,36.5 9,32 Z"
        fill="#9CA79A"
        stroke="#5E6B5C"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M14,24 C16,21.5 19.5,21.5 21.5,23.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.5}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
