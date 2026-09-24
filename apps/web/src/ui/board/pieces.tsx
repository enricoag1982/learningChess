import type { JSX } from 'react';
import type { Color, PieceType } from '@chess-kids/core';

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

const STROKE_WIDTH = 1.8;

/** Rounded base every piece stands on. */
function Base(): JSX.Element {
  return <rect x={9} y={35.5} width={27} height={5} rx={2.5} />;
}

function Pawn(): JSX.Element {
  return (
    <>
      <Base />
      <path d="M16,34 C15,27 16.5,23 22.5,20 C28.5,23 30,27 29,34 Z" />
      <circle cx={22.5} cy={13.5} r={6} />
    </>
  );
}

function Rook(): JSX.Element {
  return (
    <>
      <Base />
      <rect x={12.5} y={17} width={20} height={17} rx={2} />
      <rect x={12} y={15} width={21} height={5} rx={1.5} />
      <rect x={11.5} y={9} width={6} height={8} rx={1.8} />
      <rect x={19.5} y={9} width={6} height={8} rx={1.8} />
      <rect x={27.5} y={9} width={6} height={8} rx={1.8} />
    </>
  );
}

function Bishop({ color }: { readonly color: Color }): JSX.Element {
  // The mitre slit is a light cut into the fill: dark line on white, pale line on black.
  const slitStroke = color === 'w' ? PALETTE.w.stroke : PALETTE.b.detail;
  return (
    <>
      <Base />
      <path d="M14.5,34 C13.5,25 14.5,20 18,17 C15.5,15 15.5,12.5 18,11 C20,13 22,13 22.5,10.5 C23,13 25,13 27,11 C29.5,12.5 29.5,15 27,17 C30.5,20 31.5,25 30.5,34 Z" />
      <circle cx={22.5} cy={7.5} r={3} />
      <path
        d="M19,16.5 L26,20.5"
        fill="none"
        stroke={slitStroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </>
  );
}

function Knight({ color }: { readonly color: Color }): JSX.Element {
  // Eye/nostril read as shapes cut into the fill, so they show on both colours: dark ink on
  // white, a pale line on black.
  const markStroke = color === 'w' ? PALETTE.w.stroke : PALETTE.b.detail;
  return (
    <>
      <Base />
      {/* Horse head + neck, facing left: a sharp muzzle at the left, arched mane over the top. */}
      <path
        d="M8,20
           C7,18.5 7.5,16.5 9,15
           C11,12.5 13,10.5 16,9
           C20,7 25,7 29,9.5
           C33,12 34,16 33,21
           C32,26 31.5,30.5 31,35
           L14,35
           C13,31 11.5,27.5 10.5,24
           C9.5,22.5 8.5,21 8,20
           Z"
      />
      {/* pointed ear */}
      <path d="M21,9 C19,5.5 22,1.5 26,3 C28,4.5 27,8 23,9.5 Z" />
      <circle cx={14} cy={13.5} r={1.4} fill={markStroke} stroke="none" />
      <path
        d="M9.5,17.5 C10.3,18.3 11.3,18.4 12,17.9"
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
  const bandOpacity = color === 'w' ? 0.25 : 0.55;
  return (
    <>
      <Base />
      <path d="M14,34 C13,26 14,21 17,18 C14.5,16 14.5,13.5 17,12 C19,14 21,14 22.5,11.5 C24,14 26,14 28,12 C30.5,13.5 30.5,16 28,18 C31,21 32,26 31,34 Z" />
      <rect x={13} y={16} width={19} height={2.4} rx={1.2} fill={bandFill} opacity={bandOpacity} />
      {[13.5, 18.5, 22.5, 26.5, 31.5].map((cx, index) => (
        <circle key={cx} cx={cx} cy={9.5} r={index === 2 ? 3.4 : 2.7} />
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
      <path d="M15,34 C14,26 15,21.5 18,18.5 C16,16.5 16,14.5 18,13 C20,15 22,15 22.5,13 C23,15 25,15 27,13 C29,14.5 29,16.5 27,18.5 C30,21.5 31,26 30,34 Z" />
      <rect
        x={13.5}
        y={17}
        width={18}
        height={5}
        rx={1.8}
        fill={accentFill}
        opacity={bandOpacity}
      />
      <rect x={21} y={5} width={3} height={9} rx={1.2} fill={accentFill} />
      <rect x={17.5} y={7.5} width={10} height={3} rx={1.2} fill={accentFill} />
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
        <g fill="none" stroke={colours.detail} strokeWidth={1.1} strokeLinecap="round">
          <ShadeLines type={piece.type} />
        </g>
      )}
    </svg>
  );
}

/** Light inner detail strokes on black pieces, so shape detail stays visible against the dark fill. */
function ShadeLines({ type }: { readonly type: PieceType }): JSX.Element {
  switch (type) {
    case 'p':
      return <path d="M19,26 C19,22.5 20.5,20.5 22.5,19.5" />;
    case 'r':
      return (
        <>
          <path d="M15,20 L15,32" />
          <path d="M30,20 L30,32" />
        </>
      );
    case 'b':
      return <path d="M18.5,25 C18,20 19.5,15.5 22.5,12.5" />;
    case 'n':
      return <path d="M12,29 C10.5,24 11,19 14.5,15" />;
    case 'q':
      return <path d="M18,27 C17,20 18.5,15 22.5,12.5" />;
    case 'k':
      return <path d="M18.5,27 C17.5,21 18.5,16.5 21,14" />;
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
