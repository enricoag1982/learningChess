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

/** Placeholder character portrait, keyed by character id; falls back to a plain badge. */
export function CharacterIcon({ character }: { readonly character: string }): JSX.Element {
  if (character === 'rhino') {
    return <RhinoFace />;
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
