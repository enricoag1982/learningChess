import type { ComponentType, JSX } from 'react';
import type { Avatar } from '@chess-kids/core';
import { FoxIcon } from './characters.tsx';

/** Flat bear head placeholder. */
function BearIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={26} cy={26} r={13} fill="#A9795A" />
      <circle cx={74} cy={26} r={13} fill="#A9795A" />
      <ellipse cx={50} cy={56} rx={36} ry={32} fill="#BD8B67" />
      <ellipse cx={50} cy={64} rx={18} ry={14} fill="#E9D2B8" />
      <circle cx={38} cy={50} r={5} fill="#3B2A20" />
      <circle cx={62} cy={50} r={5} fill="#3B2A20" />
      <circle cx={50} cy={62} r={4} fill="#3B2A20" />
    </svg>
  );
}

/** Flat rabbit head placeholder. */
function RabbitIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <ellipse cx={34} cy={20} rx={9} ry={22} fill="#E7E1D6" />
      <ellipse cx={66} cy={20} rx={9} ry={22} fill="#E7E1D6" />
      <ellipse cx={34} cy={20} rx={4} ry={15} fill="#F3B8C6" />
      <ellipse cx={66} cy={20} rx={4} ry={15} fill="#F3B8C6" />
      <ellipse cx={50} cy={60} rx={34} ry={28} fill="#F2EDE3" />
      <circle cx={39} cy={56} r={5} fill="#3B2A20" />
      <circle cx={61} cy={56} r={5} fill="#3B2A20" />
      <ellipse cx={50} cy={68} rx={6} ry={4} fill="#F3B8C6" />
    </svg>
  );
}

/** Flat cat head placeholder. */
function CatIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <path d="M18 14 L38 38 L20 40 Z" fill="#E5A855" />
      <path d="M82 14 L62 38 L80 40 Z" fill="#E5A855" />
      <ellipse cx={50} cy={58} rx={34} ry={28} fill="#EFBD79" />
      <circle cx={38} cy={54} r={5} fill="#3B2A20" />
      <circle cx={62} cy={54} r={5} fill="#3B2A20" />
      <path d="M50 62 L46 68 L54 68 Z" fill="#3B2A20" />
      <path d="M14 62 L38 66 M14 70 L38 70" stroke="#B87F3A" strokeWidth={2} fill="none" />
      <path d="M86 62 L62 66 M86 70 L62 70" stroke="#B87F3A" strokeWidth={2} fill="none" />
    </svg>
  );
}

/** Flat panda head placeholder. */
function PandaIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={24} cy={24} r={13} fill="#2E2A26" />
      <circle cx={76} cy={24} r={13} fill="#2E2A26" />
      <ellipse cx={50} cy={58} rx={35} ry={30} fill="#F7F5EF" />
      <ellipse cx={37} cy={54} rx={11} ry={13} fill="#2E2A26" />
      <ellipse cx={63} cy={54} rx={11} ry={13} fill="#2E2A26" />
      <circle cx={37} cy={56} r={4} fill="#F7F5EF" />
      <circle cx={63} cy={56} r={4} fill="#F7F5EF" />
      <ellipse cx={50} cy={68} rx={5} ry={4} fill="#2E2A26" />
    </svg>
  );
}

/** Flat penguin head/body placeholder. */
function PenguinIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <ellipse cx={50} cy={56} rx={32} ry={34} fill="#2E3A44" />
      <ellipse cx={50} cy={62} rx={19} ry={24} fill="#F7F5EF" />
      <circle cx={41} cy={44} r={5} fill="#1B2228" />
      <circle cx={59} cy={44} r={5} fill="#1B2228" />
      <path d="M50 50 L44 58 L56 58 Z" fill="#E9A92B" />
    </svg>
  );
}

/** Flat frog head placeholder. */
function FrogIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={34} cy={28} r={13} fill="#8FBF6B" />
      <circle cx={66} cy={28} r={13} fill="#8FBF6B" />
      <circle cx={34} cy={28} r={6} fill="#2E3A22" />
      <circle cx={66} cy={28} r={6} fill="#2E3A22" />
      <ellipse cx={50} cy={62} rx={36} ry={26} fill="#9FCB7A" />
      <path
        d="M28 66 Q50 80 72 66"
        stroke="#2E3A22"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Flat elephant head placeholder. */
function ElephantIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <ellipse cx={16} cy={54} rx={16} ry={22} fill="#AEB7BE" />
      <ellipse cx={84} cy={54} rx={16} ry={22} fill="#AEB7BE" />
      <ellipse cx={50} cy={52} rx={33} ry={28} fill="#C3CBD1" />
      <circle cx={39} cy={48} r={5} fill="#3B2A20" />
      <circle cx={61} cy={48} r={5} fill="#3B2A20" />
      <path
        d="M46 62 Q42 84 34 88"
        stroke="#C3CBD1"
        strokeWidth={12}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon component per fixed avatar id (kept out of `avatar-meta.ts` so Fast Refresh stays happy:
 * this module only exports components). */
const AVATAR_ICONS: Readonly<Record<Avatar, ComponentType>> = {
  fox: FoxIcon,
  bear: BearIcon,
  rabbit: RabbitIcon,
  cat: CatIcon,
  panda: PandaIcon,
  penguin: PenguinIcon,
  frog: FrogIcon,
  elephant: ElephantIcon,
};

/** Renders the icon for `avatar`, falling back to the fox placeholder for an unknown id. */
export function AvatarIcon({ avatar }: { readonly avatar: string }): JSX.Element {
  const Icon = (AVATAR_ICONS as Record<string, ComponentType | undefined>)[avatar] ?? FoxIcon;
  return <Icon />;
}
