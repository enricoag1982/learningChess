import type { JSX } from 'react';

/** Flat rhino head, own placeholder artwork (kept simple until AI illustrations arrive). */
function RhinoFace(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <ellipse cx={50} cy={58} rx={34} ry={28} fill="#B7C4B2" />
      <ellipse cx={50} cy={78} rx={22} ry={16} fill="#CBD6C6" />
      <path d="M50 58 L42 82 L58 82 Z" fill="#8FA089" />
      <circle cx={34} cy={45} r={9} fill="#B7C4B2" stroke="#8FA089" strokeWidth={2} />
      <circle cx={66} cy={45} r={9} fill="#B7C4B2" stroke="#8FA089" strokeWidth={2} />
      <circle cx={38} cy={62} r={4} fill="#33463A" />
      <circle cx={62} cy={62} r={4} fill="#33463A" />
    </svg>
  );
}

/** Flat elephant head: big floppy ears, curved trunk (bishop's story: diagonal, wide-reaching). */
function ElephantFace(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <ellipse cx={22} cy={52} rx={16} ry={20} fill="#AEB9C7" stroke="#7C8CA0" strokeWidth={2} />
      <ellipse cx={78} cy={52} rx={16} ry={20} fill="#AEB9C7" stroke="#7C8CA0" strokeWidth={2} />
      <ellipse cx={50} cy={50} rx={30} ry={28} fill="#C7D0DC" />
      <path
        d="M42 66 Q40 86 52 90 Q58 92 56 84"
        fill="none"
        stroke="#C7D0DC"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <circle cx={40} cy={44} r={4} fill="#33404F" />
      <circle cx={62} cy={44} r={4} fill="#33404F" />
    </svg>
  );
}

/** Flat lioness head: rounded, no mane (queen's story: strongest hunter). */
function LionessFace(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <ellipse cx={50} cy={54} rx={32} ry={28} fill="#E3AE72" />
      <path d="M26 32 L34 46 L20 44 Z" fill="#E3AE72" />
      <path d="M74 32 L66 46 L80 44 Z" fill="#E3AE72" />
      <ellipse cx={50} cy={68} rx={20} ry={14} fill="#F2CB98" />
      <circle cx={38} cy={50} r={4.5} fill="#5A3A1E" />
      <circle cx={62} cy={50} r={4.5} fill="#5A3A1E" />
      <path d="M50 62 L45 68 L55 68 Z" fill="#5A3A1E" />
    </svg>
  );
}

/** Flat lion head: rounded face with a scalloped mane (king's story: most important, stays safe). */
function LionFace(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={50} cy={54} r={38} fill="#D98A2B" />
      <circle cx={20} cy={40} r={9} fill="#D98A2B" />
      <circle cx={80} cy={40} r={9} fill="#D98A2B" />
      <circle cx={16} cy={62} r={9} fill="#D98A2B" />
      <circle cx={84} cy={62} r={9} fill="#D98A2B" />
      <circle cx={30} cy={84} r={9} fill="#D98A2B" />
      <circle cx={70} cy={84} r={9} fill="#D98A2B" />
      <ellipse cx={50} cy={54} rx={26} ry={24} fill="#F2CB98" />
      <ellipse cx={50} cy={70} rx={16} ry={11} fill="#FBE3C4" />
      <circle cx={40} cy={50} r={4} fill="#5A3A1E" />
      <circle cx={60} cy={50} r={4} fill="#5A3A1E" />
      <path d="M50 60 L45 66 L55 66 Z" fill="#5A3A1E" />
    </svg>
  );
}

/** Flat horse head: long muzzle, pointed ears, forelock tuft (knight's story: jumps in an L). */
function HorseFace(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <path d="M32 20 L40 40 L26 40 Z" fill="#8A5A3C" />
      <path d="M68 20 L60 40 L74 40 Z" fill="#8A5A3C" />
      <ellipse cx={50} cy={46} rx={26} ry={24} fill="#A9744E" />
      <ellipse cx={50} cy={76} rx={16} ry={22} fill="#A9744E" />
      <path d="M38 30 Q50 18 62 30 L58 38 Q50 32 42 38 Z" fill="#5E3A22" />
      <circle cx={38} cy={44} r={4.5} fill="#2E1B10" />
      <circle cx={62} cy={44} r={4.5} fill="#2E1B10" />
      <ellipse cx={50} cy={90} rx={10} ry={5} fill="#5E3A22" />
    </svg>
  );
}

/** Flat caterpillar head: round segments and small antennae (pawn's story: creeps forward, transforms at the last row). */
function CaterpillarFace(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={30} cy={70} r={16} fill="#8FBB8A" />
      <circle cx={54} cy={66} r={19} fill="#9FC99A" />
      <circle cx={50} cy={40} r={24} fill="#AFDBA9" />
      <path d="M40 22 L34 8" stroke="#6E9C69" strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M58 22 L66 9" stroke="#6E9C69" strokeWidth={4} strokeLinecap="round" fill="none" />
      <circle cx={34} cy={8} r={4} fill="#6E9C69" />
      <circle cx={66} cy={9} r={4} fill="#6E9C69" />
      <circle cx={41} cy={38} r={5} fill="#33463A" />
      <circle cx={59} cy={38} r={5} fill="#33463A" />
      <path
        d="M42 50 Q50 56 58 50"
        stroke="#33463A"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Placeholder character portrait, keyed by character id; falls back to a plain badge. */
export function CharacterIcon({ character }: { readonly character: string }): JSX.Element {
  if (character === 'rhino') {
    return <RhinoFace />;
  }
  if (character === 'elephant') {
    return <ElephantFace />;
  }
  if (character === 'lioness') {
    return <LionessFace />;
  }
  if (character === 'lion') {
    return <LionFace />;
  }
  if (character === 'horse') {
    return <HorseFace />;
  }
  if (character === 'caterpillar') {
    return <CaterpillarFace />;
  }
  if (character === 'owl') {
    return <OwlIcon />;
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={50} cy={50} r={40} fill="#B7C4B2" />
    </svg>
  );
}

/** Flat owl placeholder: the narrator's avatar everywhere a speech bubble appears. */
export function OwlIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <path d="M28 30 L38 12 L46 28 Z" fill="#8A72AE" />
      <path d="M72 30 L62 12 L54 28 Z" fill="#8A72AE" />
      <ellipse cx={50} cy={58} rx={36} ry={32} fill="#A98FC9" />
      <circle cx={36} cy={52} r={15} fill="#FFFFFF" />
      <circle cx={64} cy={52} r={15} fill="#FFFFFF" />
      <circle cx={36} cy={52} r={7} fill="#4B3A63" />
      <circle cx={64} cy={52} r={7} fill="#4B3A63" />
      <path d="M50 60 L44 72 L56 72 Z" fill="#E9A92B" />
    </svg>
  );
}

/** Flat fox placeholder: the kid's own profile avatar. */
export function FoxIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <path d="M20 20 L38 40 L26 44 Z" fill="#E8A468" />
      <path d="M80 20 L62 40 L74 44 Z" fill="#E8A468" />
      <ellipse cx={50} cy={58} rx={34} ry={30} fill="#EFAE73" />
      <path d="M50 62 L36 80 L64 80 Z" fill="#FFFFFF" />
      <circle cx={38} cy={54} r={5} fill="#3B2A20" />
      <circle cx={62} cy={54} r={5} fill="#3B2A20" />
      <path d="M50 66 L45 72 L55 72 Z" fill="#3B2A20" />
    </svg>
  );
}
