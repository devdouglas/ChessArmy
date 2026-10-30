import {
  ammoLeft,
  isReloading,
  PALISADE_HP,
  roleOf,
  statsOf,
  type AbilityId,
  type Piece,
  type Affiliation,
  type Side,
  type TokenType,
  type UnitRole,
  type UnitTokenType,
  type UnitType,
} from './engine';
import { hexCorners, type HexOrientation } from './hex';

/** Compact silhouettes centered at 0,0 — viewBox roughly -10..10. */
const ICONS: Record<UnitRole, string> = {
  // Helmet + torso
  soldier: `
    <circle cx="0" cy="-4.2" r="2.6"/>
    <path d="M-4.2 -2.2 Q0 -5.5 4.2 -2.2 L3.2 0.5 H-3.2 Z"/>
    <path d="M-3.4 1.2 H3.4 L2.6 6.5 H-2.6 Z"/>
    <rect x="-0.7" y="1.5" width="1.4" height="4.5" rx="0.4"/>
  `,
  // Horse head (chess knight) + speed lines
  scout: `
    <g fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round">
      <path d="M-9.2 -5.4 L-5.6 -5.4"/>
      <path d="M-9.6 -2.6 L-5.8 -2.6"/>
      <path d="M-9.0 0.2 L-5.6 0.2"/>
      <path d="M-8.6 2.8 L-5.4 2.8"/>
    </g>
    <path d="M-5.4 7.2
      L-5.8 2.2
      C-5.6 -1.2 -4.2 -4.2 -1.8 -6.2
      C-0.8 -7.4 0.4 -8.4 1.6 -8.8
      L2.4 -6.6
      C4.4 -6.2 6.6 -4.8 7.8 -3.2
      C8.8 -2.0 8.6 -0.4 7.2 0.1
      C6.2 0.4 5.4 -0.5 4.8 -1.1
      C3.2 0.6 1.6 2.8 0.6 5.0
      L0.1 7.2
      Z"/>
  `,
  // Bazooka rocket — nose cone + body + fins
  bazooka: `
    <path d="M5.5 0 L-1.5 -2.6 L-1.5 2.6 Z"/>
    <rect x="-7" y="-2.2" width="6" height="4.4" rx="0.6"/>
    <path d="M-7 -2.2 L-9.5 -4.2 L-7 -0.4 Z"/>
    <path d="M-7 2.2 L-9.5 4.2 L-7 0.4 Z"/>
    <path d="M-7 -1.2 L-9.2 0 L-7 1.2 Z"/>
  `,
  // Bow + nocked arrow
  archer: `
    <path d="M-4.8 -8.0
      C-8.4 -4.4 -8.4 4.4 -4.8 8.0
      L-3.0 6.4
      C-5.8 3.2 -5.8 -3.2 -3.0 -6.4
      Z"/>
    <path d="M-3.2 -6.6 L-3.2 6.6 L-1.8 6.6 L-1.8 -6.6 Z"/>
    <rect x="-7.0" y="-0.7" width="13.4" height="1.4" rx="0.35"/>
    <path d="M5.6 -2.6 L9.2 0 L5.6 2.6 Z"/>
    <path d="M-7.0 -2.3 L-4.4 0 L-7.0 2.3 Z"/>
  `,
  // Two leaf-headed javelins
  javelin: `
    <g transform="translate(-1.35,0.85) rotate(-50)">
      <rect x="-7.1" y="-0.48" width="11.0" height="0.96" rx="0.35"/>
      <path d="M3.7 -1.55 L8.55 0 L3.7 1.55 Z"/>
      <path d="M-7.1 -0.85 L-8.55 0 L-7.1 0.85 Z"/>
    </g>
    <g transform="translate(1.2,-0.55) rotate(-24)">
      <rect x="-7.45" y="-0.62" width="11.9" height="1.24" rx="0.4"/>
      <path d="M4.2 -2.05 L9.55 0 L4.2 2.05 L5.2 0 Z"/>
      <path d="M-7.45 -1.05 L-9.15 0 L-7.45 1.05 Z"/>
    </g>
  `,
  // Knight horse + recurve bow
  horsearcher: `
    <g transform="translate(-2.55,0.35) scale(0.72)">
      <path d="M-5.4 7.2
        L-5.8 2.2
        C-5.6 -1.2 -4.2 -4.2 -1.8 -6.2
        C-0.8 -7.4 0.4 -8.4 1.6 -8.8
        L2.4 -6.6
        C4.4 -6.2 6.6 -4.8 7.8 -3.2
        C8.8 -2.0 8.6 -0.4 7.2 0.1
        C6.2 0.4 5.4 -0.5 4.8 -1.1
        C3.2 0.6 1.6 2.8 0.6 5.0
        L0.1 7.2
        Z"/>
    </g>
    <g transform="translate(4.35,0.15)">
      <path d="M-0.55 -7.15
        C3.45 -3.85 3.45 3.85 -0.55 7.15
        L0.7 5.75
        C3.35 2.85 3.35 -2.85 0.7 -5.75
        Z"/>
      <path d="M0.55 -5.95 L0.55 5.95 L1.55 5.95 L1.55 -5.95 Z"/>
      <rect x="-3.7" y="-0.52" width="10.35" height="1.04" rx="0.3"/>
      <path d="M6.05 -1.75 L8.55 0 L6.05 1.75 Z"/>
    </g>
  `,
  // Wheel, cab, horse, bow
  chariotarcher: `
    <path fill-rule="evenodd" d="M-3.45 5.05 m-3.55 0 a3.55 3.55 0 1 0 7.1 0 a3.55 3.55 0 1 0 -7.1 0
      M-3.45 5.05 m-2.25 0 a2.25 2.25 0 1 0 4.5 0 a2.25 2.25 0 1 0 -4.5 0"/>
    <circle cx="-3.45" cy="5.05" r="0.7"/>
    <rect x="-3.85" y="1.7" width="0.8" height="6.7" rx="0.25"/>
    <rect x="-6.8" y="4.65" width="6.7" height="0.8" rx="0.25"/>
    <path d="M-6.35 -0.2 H0.75 V3.75 H-6.35 Z"/>
    <path d="M-6.35 -0.2 V-1.85 H0.75 V-0.2"/>
    <circle cx="-2.45" cy="-3.5" r="1.65"/>
    <rect x="-0.25" y="1.75" width="5.2" height="0.8" rx="0.25"/>
    <ellipse cx="5.75" cy="2.5" rx="3.7" ry="1.95"/>
    <path d="M8.2 1.15 C10.05 -0.9 8.1 -3.55 5.55 -2.4 L6.25 0.3 Z"/>
    <rect x="3.5" y="4.05" width="1.15" height="3.95" rx="0.4"/>
    <rect x="6.85" y="4.05" width="1.15" height="3.75" rx="0.4"/>
    <path d="M0.2 -6.65 C3.45 -3.8 3.45 0.55 0.2 3.4 L1.15 2.2 C3.25 0.05 3.25 -3.3 1.15 -5.45 Z"/>
    <rect x="-2.55" y="-1.7" width="6.15" height="0.9" rx="0.25"/>
    <path d="M3.25 -2.55 L5.55 -1.25 L3.25 0.05 Z"/>
  `,
  // Soldier behind the scutum; gladius in front, along the shield's right edge
  cohort: `
    <g transform="translate(0.35,-1.15) scale(0.8)">
      <circle cx="0" cy="-4.2" r="2.6"/>
      <path d="M-4.2 -2.2 Q0 -5.5 4.2 -2.2 L3.2 0.5 H-3.2 Z"/>
      <path d="M-3.4 1.2 H3.4 L2.6 6.5 H-2.6 Z"/>
      <rect x="-0.7" y="1.5" width="1.4" height="4.5" rx="0.4"/>
    </g>
    <g transform="translate(6.5,1)">
      <path fill-rule="evenodd" d="M-9.15 -5.55
        Q-10.05 0.15 -9.15 5.85
        L-5.45 6.45
        Q-6.35 0.15 -5.45 -6.05
        Z
        M-7.3 0.15 m-1.05 0 a1.05 1.05 0 1 0 2.1 0 a1.05 1.05 0 1 0 -2.1 0"/>
      <circle cx="-7.3" cy="0.15" r="0.42"/>
    </g>
    <g transform="translate(7.35,1.15)">
      <path d="M-3.95 1.85 L-4.28 -2.15 L-3.55 -6.35 L-2.82 -2.15 L-3.15 1.85 Z"/>
      <rect x="-4.55" y="1.75" width="2.0" height="0.72" rx="0.16"/>
      <rect x="-3.82" y="2.42" width="0.54" height="2.05" rx="0.16"/>
      <circle cx="-3.55" cy="4.95" r="0.72"/>
    </g>
  `,
  // Helmet behind aspis, crest above the rim
  hoplite: `
    <ellipse cx="-0.2" cy="-5.15" rx="2.85" ry="2.2"/>
    <path d="M-0.85 -6.8 Q0.35 -10.3 1.7 -6.8 L1.15 -5.2 H-0.3 Z"/>
    <path fill-rule="evenodd" d="M-0.4 2.05 m-6.35 0 a6.35 6.35 0 1 0 12.7 0 a6.35 6.35 0 1 0 -12.7 0
      M-0.4 2.05 m-4.2 0 a4.2 4.2 0 1 0 8.4 0 a4.2 4.2 0 1 0 -8.4 0"/>
    <circle cx="-0.4" cy="2.05" r="1.5"/>
    <rect x="5.15" y="-7.6" width="1.4" height="15.6" rx="0.4"/>
    <path d="M4.8 -7.4 L5.85 -9.6 L6.9 -7.4 Z"/>
  `,
  // War elephant — ear, trunk, tusk
  elephant: `
    <ellipse cx="-1.4" cy="2.2" rx="5.8" ry="4.2"/>
    <rect x="-5.4" y="4.4" width="2.3" height="4.0" rx="0.65"/>
    <rect x="0.0" y="4.4" width="2.3" height="4.0" rx="0.65"/>
    <path d="M1.4 -0.2
      C-1.2 -6.6 -7.2 -4.6 -5.6 1.2
      C-3.4 2.0 0.2 1.6 1.4 -0.2 Z"/>
    <circle cx="4.6" cy="-1.0" r="3.15"/>
    <path d="M7.0 0.3
      C9.4 2.6 8.8 7.0 5.8 8.6
      C7.2 5.4 7.4 2.8 6.4 0.8 Z"/>
    <path d="M6.0 0.2 L9.2 3.2 L6.6 1.2 Z"/>
    <path d="M-3.2 -2.0 H1.4 V-4.4 H-0.4 L-1.0 -6.0 L-1.6 -4.4 H-3.2 Z"/>
  `,
  // Horned helm + greataxe
  barbarian: `
    <path d="M-2.6 -4.4 L-7.2 -8.6 L-4.2 -3.6 Z"/>
    <path d="M2.6 -4.4 L7.2 -8.6 L4.2 -3.6 Z"/>
    <ellipse cx="0" cy="-3.2" rx="3.5" ry="2.7"/>
    <path d="M-2.2 -2.0 Q0 3.6 2.2 -2.0 L1.3 0.6 H-1.3 Z"/>
    <rect x="-0.5" y="1.0" width="1.0" height="7.0" rx="0.35"/>
    <path d="M0.4 1.5 L7.6 -1.4 L8.2 1.8 L6.2 5.2 L0.4 4.2 Z"/>
    <path d="M-2.7 6.4 H2.7 L2.1 8.8 H-2.1 Z"/>
  `,
  // Onager — A-frame + cocked arm + stone
  catapult: `
    <rect x="-7.4" y="4.6" width="13.6" height="2.4" rx="0.4"/>
    <circle cx="-4.8" cy="7.1" r="1.55"/>
    <circle cx="4.0" cy="7.1" r="1.55"/>
    <path d="M-5.2 4.8 L0.2 -3.4 L1.6 -3.4 L5.6 4.8 H3.6 L0.9 -0.8 L-3.2 4.8 Z"/>
    <path d="M-7.0 0.6 L4.4 -7.6 L5.6 -6.2 L-5.8 2.0 Z"/>
    <path d="M3.6 -8.8 L7.4 -7.6 L6.6 -4.8 L3.0 -6.0 Z"/>
    <circle cx="5.8" cy="-7.0" r="1.55"/>
  `,
  // Rifle + large crosshair scope
  sniper: `
    <circle cx="-4.5" cy="-3.2" r="1.6"/>
    <path d="M-6 -1.2 H-3.2 L-2.6 5.5 H-5.5 Z"/>
    <rect x="-3.5" y="-0.4" width="8" height="1.2" rx="0.4" transform="rotate(-10 1 0)"/>
    <g fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round">
      <circle cx="3.2" cy="-2.8" r="4.2"/>
      <circle cx="3.2" cy="-2.8" r="2.2"/>
      <path d="M3.2 -7.6 V1.8 M-1.6 -2.8 H8"/>
    </g>
  `,
  // Hull + turret + barrel
  tank: `
    <rect x="-6.5" y="1.2" width="13" height="3.8" rx="1.2"/>
    <rect x="-5.2" y="-1.2" width="10.4" height="3.2" rx="1"/>
    <rect x="-2.2" y="-4.2" width="4.4" height="3.5" rx="0.8"/>
    <rect x="1.8" y="-3.4" width="6.5" height="1.4" rx="0.5"/>
    <circle cx="-3.5" cy="3.1" r="1.3"/>
    <circle cx="0" cy="3.1" r="1.3"/>
    <circle cx="3.5" cy="3.1" r="1.3"/>
  `,
  // Star + peaked silhouette
  general: `
    <path d="M0 -7 L1.5 -3.2 H5.5 L2.2 -0.8 L3.5 3.2 L0 1.2 L-3.5 3.2 L-2.2 -0.8 L-5.5 -3.2 H-1.5 Z"/>
    <path d="M-3.8 4.2 H3.8 L2.8 7 H-2.8 Z"/>
  `,
  // Keep — shaft, merlons, slit
  tower: `
    <path d="M-7 7.5 H7 L5.5 3 H-5.5 Z"/>
    <path d="M-4.8 3 H4.8 V-2.1 H-4.8 Z"/>
    <path d="M-6.3 -2.1 H6.3 V-3.9
      H4.7 V-7.3 H2.7 V-3.9
      H1.0 V-7.3 H-1.0 V-3.9
      H-2.7 V-7.3 H-4.7 V-3.9
      H-6.3 Z"/>
    <rect x="-1.15" y="-0.15" width="2.3" height="2.5" rx="0.35"/>
  `,
  // Scarecrow — pole, crossbar, sack head, ragged hat
  dummy: `
    <rect x="-0.7" y="-1.6" width="1.4" height="10.4" rx="0.4"/>
    <rect x="-7.4" y="-1.4" width="14.8" height="1.55" rx="0.5"/>
    <path d="M-7.4 -1.4 L-9.2 -3.6 L-8.4 -0.2 L-7.0 0.2 Z"/>
    <path d="M7.4 -1.4 L9.2 -3.6 L8.4 -0.2 L7.0 0.2 Z"/>
    <path d="M-7.2 0.1 L-8.8 2.6 L-6.6 0.9 Z"/>
    <path d="M7.2 0.1 L8.8 2.6 L6.6 0.9 Z"/>
    <ellipse cx="0" cy="-4.9" rx="3.55" ry="3.2"/>
    <ellipse cx="0" cy="-7.15" rx="4.6" ry="0.95"/>
    <path d="M-2.35 -7.15 Q0 -9.9 2.35 -7.15 Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
      d="M-1.55 -5.55 L-0.35 -4.35 M-0.35 -5.55 L-1.55 -4.35
         M0.35 -5.55 L1.55 -4.35 M1.55 -5.55 L0.35 -4.35"/>
    <path d="M-2.4 8.8 H2.4 L0.9 10 H-0.9 Z"/>
  `,
  // Hooded levy + pitchfork
  peasant: `
    <rect x="3.15" y="-5.6" width="1.1" height="13.4" rx="0.35"/>
    <path d="M1.35 -7.5 H6.05 V-6.05 H5.2 V-7.25 H4.3 V-5.55 H3.1 V-7.25 H2.2 V-6.05 H1.35 Z"/>
    <path d="M-3.15 -2.05 Q0 -7.9 3.15 -2.05 L2.15 0.55 H-2.15 Z"/>
    <circle cx="0" cy="-3.15" r="1.95"/>
    <path d="M-3.55 0.95 H3.55 L2.65 7.5 H-2.65 Z"/>
  `,
  // Peasant + brim hat. Fork sits right of the brim, tines above it.
  dude: `
    <circle cx="0" cy="-2.55" r="1.95"/>
    <path d="M-3.55 0.95 H3.55 L2.65 7.5 H-2.65 Z"/>
    <ellipse cx="0" cy="-4.85" rx="3.05" ry="0.88"/>
    <path d="M-2.05 -4.95 Q0 -8.45 2.05 -4.95 Z"/>
    <rect x="5.25" y="-6.85" width="1.1" height="14.6" rx="0.35"/>
    <path d="M3.45 -8.85 H8.15 V-7.4 H7.3 V-8.6 H6.4 V-6.9 H5.2 V-8.6 H4.3 V-7.4 H3.45 Z"/>
  `,
  // Wolf — lunge, hackles, open jaws. Snout right.
  wolf: `
    <path fill-rule="evenodd" d="M-5.6 1.6
      L-8.9 -2.4 L-7.1 -0.2 L-8.2 1.5 L-6.4 0.6
      L-4.6 -1.7 L-3.5 0.3 L-2.2 -2.1 L-1.1 0.1 L0.2 -1.5
      L1.5 -0.3 L0.6 -4.7 L2.5 -0.5 L3.2 -5.1 L4.6 -0.6
      L8.7 -1.3 L9.5 0.2 L7.9 0.5 L8.7 1.5 L7.2 0.9
      L6.5 2.7 L4.6 1.6 L3.8 3.1
      C1.6 3.6 -0.4 3.1 -2.2 3.5
      L-1.2 7.7 L-2.9 7.7 L-3.4 3.8
      L-4.8 4.1 L-5.6 7.9 L-7.3 7.9
      C-6.8 4.4 -6.2 2.8 -5.6 1.6 Z
      M5.7 0.35 L7.6 -0.15 L7.15 1.45 Z
      M3.55 -1.55 L4.35 -0.85 L2.85 -0.95 Z"/>
  `,
  // Delta interceptor
  fighter: `
    <path d="M0 -8.4 L7.2 6.6 L0 3.4 L-7.2 6.6 Z"/>
    <ellipse cx="0" cy="-2.15" rx="1.25" ry="2.05"/>
    <rect x="-3.35" y="5.05" width="2.35" height="2.85" rx="0.4"/>
    <rect x="1.0" y="5.05" width="2.35" height="2.85" rx="0.4"/>
  `,
  // Chin-gun hull + stub wings
  gunship: `
    <ellipse cx="0" cy="0.15" rx="2.35" ry="7.05"/>
    <path d="M-2.15 -0.55 L-8.7 1.35 L-8.25 3.35 L-2.15 1.7 Z"/>
    <path d="M2.15 -0.55 L8.7 1.35 L8.25 3.35 L2.15 1.7 Z"/>
    <ellipse cx="0" cy="-4.55" rx="1.45" ry="1.75"/>
    <path d="M-1.55 5.45 H1.55 L0.85 7.35 H-0.85 Z"/>
    <rect x="-0.5" y="6.85" width="1.0" height="2.55" rx="0.28"/>
  `,
  // Fat flying wing + twin tails
  bomber: `
    <path d="M0 -6.55 L9.35 4.55 L3.45 3.05 L3.45 7.05 L0 5.35 L-3.45 7.05 L-3.45 3.05 L-9.35 4.55 Z"/>
    <ellipse cx="0" cy="-0.55" rx="2.15" ry="3.25"/>
    <rect x="-1.7" y="4.55" width="3.4" height="2.9" rx="0.4"/>
  `,
  // Slim warship hull
  frigate: `
    <path d="M0 -8.7 L2.55 -4.05 L2.7 6.15 L1.25 8.45 L-1.25 8.45 L-2.7 6.15 L-2.55 -4.05 Z"/>
    <rect x="-1.55" y="-1.7" width="3.1" height="4.55" rx="0.4"/>
    <rect x="-0.7" y="-5.05" width="1.4" height="2.5" rx="0.3"/>
    <rect x="-2.15" y="6.45" width="1.5" height="2.25" rx="0.3"/>
    <rect x="0.65" y="6.45" width="1.5" height="2.25" rx="0.3"/>
  `,
  // Capital hull + wing guns
  cruiser: `
    <path d="M0 -8.35 L3.75 -3.55 L4.15 5.45 L2.05 8.25 L-2.05 8.25 L-4.15 5.45 L-3.75 -3.55 Z"/>
    <rect x="-2.45" y="-1.25" width="4.9" height="5.25" rx="0.5"/>
    <rect x="-1.15" y="-4.55" width="2.3" height="2.85" rx="0.35"/>
    <rect x="-7.35" y="0.25" width="3.5" height="1.45" rx="0.35"/>
    <rect x="3.85" y="0.25" width="3.5" height="1.45" rx="0.35"/>
    <rect x="-1.9" y="6.15" width="1.5" height="2.4" rx="0.3"/>
    <rect x="0.4" y="6.15" width="1.5" height="2.4" rx="0.3"/>
  `,
  // Ram prow + triple turrets
  dreadnought: `
    <path d="M0 -8.15 L4.75 -3.85 L5.35 5.05 L2.65 8.45 L-2.65 8.45 L-5.35 5.05 L-4.75 -3.85 Z"/>
    <path d="M-1.7 -6.15 L0 -9.55 L1.7 -6.15 Z"/>
    <circle cx="0" cy="-2.35" r="1.65"/>
    <rect x="-0.38" y="-5.55" width="0.76" height="3.15" rx="0.2"/>
    <circle cx="-2.05" cy="1.55" r="1.4"/>
    <rect x="-4.85" y="1.2" width="2.75" height="0.7" rx="0.2"/>
    <circle cx="2.05" cy="1.55" r="1.4"/>
    <rect x="2.1" y="1.2" width="2.75" height="0.7" rx="0.2"/>
    <rect x="-1.35" y="3.35" width="2.7" height="3.15" rx="0.4"/>
    <rect x="-3.5" y="6.55" width="2.05" height="2.35" rx="0.35"/>
    <rect x="1.45" y="6.55" width="2.05" height="2.35" rx="0.35"/>
  `,
};

export function pieceIconSvg(type: UnitType, size = 16): string {
  const s = size / 20;
  return `<g class="piece-icon" transform="scale(${s})">${ICONS[roleOf(type)]}</g>`;
}

function treeMarkSvg(chips: number): string {
  const canopy =
    chips >= 2
      ? `<ellipse cx="-0.35" cy="-1.25" rx="2.05" ry="1.75" fill="var(--tree-lo)"/>
           <path d="M1.45 1.05 L4.55 3.25 L3.85 3.75 L0.85 1.5 Z" fill="var(--tree-hi)"/>`
      : chips >= 1
        ? `<ellipse cx="-1.55" cy="-2.2" rx="3.05" ry="2.75" fill="var(--tree)"/>
             <ellipse cx="1.6" cy="-1.05" rx="2.45" ry="2.2" fill="var(--tree-hi)"/>
             <path d="M2.35 0.35 L5.05 2.85 L4.35 3.35 L1.65 0.8 Z" fill="var(--tree-lo)"/>`
        : `<ellipse cx="0" cy="-2.7" rx="4.55" ry="4.05" fill="var(--tree)"/>
             <ellipse cx="-2.2" cy="-1.05" rx="2.85" ry="2.45" fill="var(--tree-hi)"/>
             <ellipse cx="2.3" cy="-0.75" rx="2.55" ry="2.2" fill="var(--tree-lo)"/>`;
  return `<ellipse cx="0" cy="6.35" rx="3.4" ry="1.15" fill="#1a1410" opacity="0.32"/>
        <path d="M-1.05 5.9 L-0.55 1.05 H0.55 L1.05 5.9 Z" fill="var(--palisade-lo)" stroke="var(--palisade-ink)" stroke-width="0.35"/>
        ${canopy}`;
}

/**
 * Overlay stamp centered at 0,0.
 * Pikes: `size` scales the -8..8 glyph (16 → native).
 * Wall: `size` is the hex radius in px (matches the tile).
 */
export function tokenGlyphSvg(
  type: TokenType,
  size = 16,
  o: HexOrientation = 'pointy',
  owner?: Side | null,
  hp?: number,
  occupied = false,
): string {
  const s = size / 16;
  if (type === 'pikes') {
    return `<g class="token-pikes" transform="scale(${s})">
      <ellipse cx="0" cy="5.4" rx="6.4" ry="1.9" fill="#2a1c10" opacity="0.38"/>
      <g fill="none" stroke="#6a4a28" stroke-width="1.35" stroke-linecap="round">
        <path d="M-4.5 6.1 L-5.6 -3.8"/>
        <path d="M0 6.6 L0 -5.2"/>
        <path d="M4.5 6.1 L5.6 -3.8"/>
      </g>
      <g fill="#c8c4b8" stroke="#6a6860" stroke-width="0.35" stroke-linejoin="round">
        <path d="M-5.6 -3.8 L-6.5 -6.2 L-4.5 -4.7 Z"/>
        <path d="M0 -5.2 L-0.75 -7.8 L0.75 -7.8 Z"/>
        <path d="M5.6 -3.8 L4.5 -4.7 L6.5 -6.2 Z"/>
      </g>
    </g>`;
  }
  if (type === 'wall') {
    const r = size;
    const sw = Math.max(1.2, r * 0.09);
    const ink = Math.max(0.7, r * 0.045);
    return `<g class="token-wall">
      <polygon points="${hexCorners(0, 0, r, o)}" fill="var(--wall)" stroke="var(--wall-stroke)" stroke-width="${sw.toFixed(2)}" stroke-linejoin="miter"/>
      <polygon points="${hexCorners(0, 0, r * 0.78, o)}" fill="var(--wall-hi)" opacity="0.45" stroke="var(--wall-ink)" stroke-width="${ink.toFixed(2)}" stroke-linejoin="miter"/>
      <polygon points="${hexCorners(0, 0, r * 0.48, o)}" fill="var(--wall-lo)" opacity="0.55" stroke="var(--wall-ink)" stroke-width="${(ink * 0.9).toFixed(2)}" stroke-linejoin="miter"/>
    </g>`;
  }
  if (type === 'palisade') {
    const r = size;
    const sw = Math.max(1.1, r * 0.08);
    const gs = r / 10;
    const left = hp ?? PALISADE_HP;
    const chips = Math.max(0, PALISADE_HP - left);
    const stake = (x: number, top: number) =>
      `<path d="M${(x - 0.72).toFixed(2)} 4.7 L${(x - 0.55).toFixed(2)} ${(top + 1.5).toFixed(2)} L${x.toFixed(2)} ${top.toFixed(2)} L${(x + 0.55).toFixed(2)} ${(top + 1.5).toFixed(2)} L${(x + 0.72).toFixed(2)} 4.7 Z"/>`;
    const standing =
      chips >= 2
        ? `${stake(-5.1, -4.8)}${stake(-3.05, -5.5)}${stake(3.1, -5.6)}${stake(5.15, -4.6)}`
        : chips >= 1
          ? `${stake(-5.1, -4.8)}${stake(-3.05, -5.5)}${stake(1.05, -5.2)}${stake(3.1, -5.6)}${stake(5.15, -4.6)}`
          : `${stake(-5.1, -4.8)}${stake(-3.05, -5.5)}${stake(-1.0, -5.1)}${stake(1.05, -5.2)}${stake(3.1, -5.6)}${stake(5.15, -4.6)}`;
    const broken =
      chips >= 2
        ? `<path d="M-1.35 4.7 L-1.15 2.55 L-0.55 2.55 L-0.35 4.7 Z" fill="var(--palisade-lo)"/>
         <path d="M-0.2 2.35 L2.85 5.15 L2.35 5.7 L-0.75 2.95 Z" fill="var(--palisade-hi)"/>
         <path d="M0.9 4.7 L1.15 3.1 L1.7 3.1 L1.95 4.7 Z" fill="var(--palisade-lo)"/>`
        : chips >= 1
          ? `<path d="M-1.35 4.7 L-1.15 2.55 L-0.55 2.55 L-0.35 4.7 Z" fill="var(--palisade-lo)"/>
         <path d="M-0.2 2.35 L2.85 5.15 L2.35 5.7 L-0.75 2.95 Z" fill="var(--palisade-hi)"/>`
          : '';
    return `<g class="token-palisade${chips ? ' damaged' : ''}">
      <polygon points="${hexCorners(0, 0, r, o)}" fill="var(--palisade)" stroke="var(--palisade-stroke)" stroke-width="${sw.toFixed(2)}" stroke-linejoin="miter"/>
      <g transform="scale(${gs.toFixed(3)})" fill="var(--palisade-hi)" stroke="var(--palisade-ink)" stroke-width="0.42" stroke-linejoin="round">
        ${standing}
        ${broken}
        <rect x="-6.15" y="0.55" width="12.3" height="1.2" rx="0.35" fill="var(--palisade-lo)"/>
      </g>
    </g>`;
  }
  if (type === 'house') {
    const gs = size / 10;
    return `<g class="token-house${occupied ? ' occupied' : ''}">
      <g transform="scale(${gs.toFixed(3)})">
        <ellipse cx="0.35" cy="6.45" rx="6.4" ry="1.25" fill="#1a1410" opacity="0.3"/>
        <path d="M-6.95 5.9 C-7.7 1.6 -7.25 -3.35 -6.4 -6.55 C-6.05 -7.7 -5.45 -7.7 -5.1 -6.55 C-4.25 -3.35 -3.8 1.6 -4.55 5.9 Z" fill="var(--house-cypress)"/>
        <path d="M-6.55 -1.1 C-6.4 -3.4 -6.15 -5.35 -5.75 -6.35 C-5.55 -6.2 -5.4 -5.2 -5.35 -3.4 C-5.3 -1.5 -5.45 0.55 -5.7 2.2 Z" fill="var(--house-cypress-hi)" opacity="0.45"/>
        <rect x="-5.95" y="5.55" width="0.9" height="1.2" rx="0.12" fill="var(--house-ink)"/>
        <rect x="-4.2" y="0.2" width="8.9" height="5.85" rx="0.28" fill="var(--house-plaster)" stroke="var(--house-ink)" stroke-width="0.45"/>
        <rect x="-4.2" y="0.2" width="8.9" height="1.35" fill="var(--house-plaster-hi)" opacity="0.55"/>
        <rect x="-4.2" y="4.55" width="8.9" height="1.5" fill="var(--house-plaster-lo)" opacity="0.38"/>
        <path d="M-5.95 0.7 L0 -5.35 L5.95 0.7 Z" fill="var(--house-roof)" stroke="var(--house-ink)" stroke-width="0.48" stroke-linejoin="round"/>
        <path d="M-4.55 -0.85 L4.55 -0.85 M-3.3 -2.2 L3.3 -2.2 M-1.95 -3.55 L1.95 -3.55" fill="none" stroke="var(--house-roof-lo)" stroke-width="0.4" stroke-linecap="round"/>
        <rect x="-6.05" y="0.28" width="12.1" height="0.72" rx="0.14" fill="var(--house-roof-lo)"/>
        <path d="M-0.7 -5.2 L0 -5.95 L0.7 -5.2 Z" fill="var(--house-roof-hi)"/>
        <rect x="-1.4" y="1.42" width="2.8" height="0.42" rx="0.08" fill="var(--house-ink)"/>
        <path d="M-1.05 6.05 V2.55 Q-1.05 1.72 0 1.72 Q1.05 1.72 1.05 2.55 V6.05 Z" fill="var(--house-door)" stroke="var(--house-ink)" stroke-width="0.28"/>
        <rect x="2.2" y="1.85" width="1.7" height="1.4" rx="0.12" fill="var(--house-door)" stroke="var(--house-ink)" stroke-width="0.22"/>
        <rect x="-3.55" y="1.85" width="1.55" height="1.4" rx="0.12" fill="var(--house-door)" stroke="var(--house-ink)" stroke-width="0.22"/>
        <ellipse cx="5.25" cy="5.55" rx="1.55" ry="0.88" fill="var(--house-hay)"/>
        <ellipse cx="5.1" cy="5.2" rx="1.15" ry="0.52" fill="var(--house-hay-hi)" opacity="0.75"/>
      </g>
    </g>`;
  }
  if (type === 'tree') {
    const gs = size / 10;
    const left = hp ?? PALISADE_HP;
    const chips = Math.max(0, PALISADE_HP - left);
    return `<g class="token-tree${chips ? ' damaged' : ''}">
      <g transform="scale(${gs.toFixed(3)})">
        ${treeMarkSvg(chips)}
      </g>
    </g>`;
  }
  if (type === 'forest') {
    const r = size;
    const gs = r / 10;
    const left = hp ?? PALISADE_HP;
    const chips = Math.max(0, PALISADE_HP - left);
    const spots = [
      { t: 'translate(-3.25,-2.05) scale(0.56)', hideAt: 2 },
      { t: 'translate(3.4,-1.55) scale(0.52)', hideAt: 1 },
      { t: 'translate(0.1,1.75) scale(0.74)', hideAt: 3 },
    ];
    const marks = spots
      .filter((tr) => chips < tr.hideAt)
      .map((tr) => `<g transform="${tr.t}">${treeMarkSvg(0)}</g>`)
      .join('');
    return `<g class="token-forest${chips ? ' damaged' : ''}">
      <g transform="scale(${gs.toFixed(3)})">${marks}</g>
    </g>`;
  }
  if (type === 'flag') {
    const side = owner ? ` ${owner}` : '';
    return `<g class="token-flag${side}" transform="scale(${s})">
      <ellipse cx="0.2" cy="6.4" rx="3.4" ry="1.15" fill="#1a1410" opacity="0.35"/>
      <path d="M-0.35 6.5 V-7.1" fill="none" stroke="#3a3228" stroke-width="1.35" stroke-linecap="round"/>
      <rect x="-0.85" y="-7.35" width="1.05" height="1.35" rx="0.25" fill="#c8b070"/>
      <path class="flag-cloth" d="M0.35 -6.85 L7.4 -4.15 L0.35 -1.15 Z"/>
    </g>`;
  }
  if (type === 'tutorial') return tutorialHandSvg(size);
  if (type === 'board') {
    return `<g class="token-board" transform="scale(${s})">
      <ellipse cx="0" cy="6.35" rx="3.1" ry="1.05" fill="#1a1410" opacity="0.32"/>
      <rect x="-0.55" y="-0.4" width="1.1" height="6.6" rx="0.25" fill="#5a3a22" stroke="#2a1810" stroke-width="0.35"/>
      <rect x="-5.35" y="-7.55" width="10.7" height="7.45" rx="0.6" fill="#c4a06a" stroke="#3a2818" stroke-width="0.55"/>
      <rect x="-4.55" y="-6.7" width="9.1" height="5.7" rx="0.28" fill="#d8b57c" stroke="#6a4a2a" stroke-width="0.28"/>
      <path d="M-3.35 -5.45 H3.25 M-3.35 -3.65 H2.45 M-3.35 -1.85 H2.95" fill="none" stroke="#5a4030" stroke-width="0.48" stroke-linecap="round"/>
      <circle class="board-seal" cx="3.55" cy="-6.55" r="0.95" fill="#a82828" stroke="#6a1818" stroke-width="0.28"/>
    </g>`;
  }
  return '';
}

/** Index finger pointing down. Catalog glyph and the post-message map hand. */
export function tutorialHandSvg(size = 16): string {
  const s = size / 18;
  return `<g class="token-tutorial" transform="scale(${s.toFixed(3)})">
    <g fill="#f7f1e4" stroke="#1a1410" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round">
      <path d="M-4.6 -8.2 H4.6 V-5.2 A2 2 0 0 1 2.6 -3.2 H-2.6 A2 2 0 0 1 -4.6 -5.2 Z"/>
      <rect x="-4.55" y="-6.15" width="2.05" height="3.15" rx="1"/>
      <rect x="-2.15" y="-7.15" width="2.05" height="3.7" rx="1"/>
      <rect x="0.25" y="-6.45" width="2.05" height="3.2" rx="1"/>
      <rect x="2.45" y="-5.35" width="1.85" height="2.35" rx="0.9"/>
      <rect x="-1.2" y="-2.15" width="2.4" height="10.5" rx="1.2"/>
    </g>
    <rect x="-0.62" y="5.55" width="1.24" height="1.7" rx="0.45" fill="#e4cbb8" stroke="#1a1410" stroke-width="0.7"/>
  </g>`;
}

/** Red prohibition overlay — Do not touch, painted onto another token. */
export function noTouchMarkSvg(r = 8): string {
  const sw = Math.max(1.15, r * 0.2);
  const inset = r * 0.62;
  return `<g class="token-notouch">
    <circle cx="0" cy="0" r="${r.toFixed(2)}" fill="#1a1f1c" fill-opacity="0.35" stroke="#e04030" stroke-width="${sw.toFixed(2)}"/>
    <path d="M ${(-inset).toFixed(2)} ${inset.toFixed(2)} L ${inset.toFixed(2)} ${(-inset).toFixed(2)}"
      fill="none" stroke="#e04030" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>
  </g>`;
}

/**
 * Facing-pike cluster. Origin at the butts, tips along local -Y.
 * Color via `currentColor` (set by `.hex-dmg-pikes.{side}`).
 */
export function facingPikeSvg(size = 16, amount = 1): string {
  const s = size / 16;
  const extra =
    amount >= 2
      ? `<path d="M-2.2 0.5 L-2.7 -7.1"/>
      <path d="M2.2 0.5 L2.7 -7.1"/>`
      : '';
  const tips =
    amount >= 2
      ? `<path d="M-2.7 -7.1 L-3.35 -9.2 L-1.95 -8.0 Z"/>
      <path d="M2.7 -7.1 L1.95 -8.0 L3.35 -9.2 Z"/>`
      : '';
  return `<g class="facing-pikes" transform="scale(${s})">
    <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
      <path d="M-4.4 0.4 L-5.4 -6.6"/>
      <path d="M0 0.6 L0 -7.6"/>
      <path d="M4.4 0.4 L5.4 -6.6"/>
      ${extra}
    </g>
    <g fill="#f4f4f0" stroke="#d8d8d4" stroke-width="0.35" stroke-linejoin="round">
      <path d="M-5.4 -6.6 L-6.3 -8.8 L-4.4 -7.4 Z"/>
      <path d="M0 -7.6 L-0.8 -10.0 L0.8 -10.0 Z"/>
      <path d="M5.4 -6.6 L4.4 -7.4 L6.3 -8.8 Z"/>
      ${tips}
    </g>
  </g>`;
}

/** Small reload badge — place at piece top-right (cx, cy relative to piece center). */
export function reloadBadgeSvg(cx: number, cy: number, r = 7): string {
  const sw = Math.max(1.2, r * 0.22);
  return `
    <g class="reload-badge" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r}" fill="#1a1f1c" stroke="#e8b840" stroke-width="1.4"/>
      <path d="M ${r * 0.35} ${-r * 0.45}
               A ${r * 0.45} ${r * 0.45} 0 1 1 ${-r * 0.2} ${r * 0.4}"
            fill="none" stroke="#f0d060" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M ${r * 0.1} ${-r * 0.55} L ${r * 0.4} ${-r * 0.25} L ${r * 0.55} ${-r * 0.6}"
            fill="#f0d060"/>
    </g>`;
}

/** Remaining HP pip — top-left of the piece. */
export function hpBadgeSvg(n: number, cx: number, cy: number, r = 7): string {
  const fs = Math.max(7, r * 1.15);
  return `
    <g class="hp-badge" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r}" fill="#fff" stroke="#111" stroke-width="1.3"/>
      <text x="0" y="0.5" text-anchor="middle" dominant-baseline="central"
        fill="#111" font-size="${fs}" font-weight="700">${n}</text>
    </g>`;
}

/** Lightning bolt, viewBox roughly -5..5 × -7..7. */
export const STAMINA_BOLT =
  'M1.5 -5.6 L-2.7 0.15 H0.55 L-2.3 5.6 L2.9 -0.15 H-0.45 Z';

/** Gold stamina bolt on a hex that will spend stamina if you move there. */
export function staminaHexMarkSvg(cx: number, cy: number, r = 8): string {
  const s = (r * 1.15) / 5.6;
  return `
    <g class="stamina-hex-mark" transform="translate(${cx}, ${cy})">
      <path d="${STAMINA_BOLT}" transform="scale(${s.toFixed(3)})" fill="#f0d060"/>
    </g>`;
}

/** Empty stamina — bolt pip, top-left, with a red prohibition ring + slash. */
export function staminaEmptyMarkSvg(
  cx: number,
  cy: number,
  r = 7,
  ghost = false,
): string {
  const ring = Math.max(1.35, r * 0.24);
  const slash = Math.max(1.55, r * 0.28);
  const inset = r * 0.64;
  const s = (r * 0.78) / 5.6;
  const fill = ghost ? 'rgba(255,255,255,0.14)' : '#1a1f1c';
  const stroke = ghost ? 'rgba(255,255,255,0.55)' : '#e04030';
  const bolt = ghost ? 'rgba(255,255,255,0.7)' : '#e8b840';
  return `
    <g class="stamina-empty-mark${ghost ? ' ghost' : ''}" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${ring.toFixed(2)}"/>
      <path d="${STAMINA_BOLT}" transform="scale(${s.toFixed(3)})" fill="${bolt}"/>
      <path d="M ${(-inset).toFixed(2)} ${inset.toFixed(2)} L ${inset.toFixed(2)} ${(-inset).toFixed(2)}"
        fill="none" stroke="${stroke}" stroke-width="${slash.toFixed(2)}" stroke-linecap="round"/>
    </g>`;
}

export type ActionGlyphId = 'energy' | 'double' | 'rest' | 'special' | 'end';

/** Same drawing as the bottom action buttons. */
export function actionGlyphSvg(
  kind: ActionGlyphId,
  opts: { className?: string; label?: string; em?: string } = {},
): string {
  const drawn = actionGlyphDrawn(kind);
  const cls = opts.className ?? 'copy-icon action';
  const a11y = opts.label
    ? ` role="img" aria-label="${opts.label}"`
    : ' aria-hidden="true"';
  const size = opts.em ? ` width="${opts.em}" height="${opts.em}"` : '';
  return `<svg class="${cls}" viewBox="${drawn.viewBox}"${size}${a11y}>${drawn.inner}</svg>`;
}

function actionGlyphDrawn(kind: ActionGlyphId): { viewBox: string; inner: string } {
  if (kind === 'energy') {
    return {
      viewBox: '-5 -7 10 14',
      inner: `<path fill="currentColor" d="${STAMINA_BOLT}"/>`,
    };
  }
  if (kind === 'double') {
    return {
      viewBox: '-12 -7 24 14',
      inner: `<path fill="currentColor" d="${STAMINA_BOLT}" transform="translate(-4.4 0) scale(0.92)"/>
       <path fill="currentColor" d="${STAMINA_BOLT}" transform="translate(4.4 0) scale(0.92)"/>`,
    };
  }
  if (kind === 'rest') {
    return {
      viewBox: '0 0 24 24',
      inner: `<text x="8" y="17" fill="currentColor" font-size="12" font-weight="800" font-family="inherit">Z</text>
       <text x="16" y="9" fill="currentColor" font-size="8" font-weight="800" font-family="inherit">z</text>`,
    };
  }
  if (kind === 'special') {
    return {
      viewBox: '0 0 24 24',
      inner: `<path fill="currentColor" d="M12 2.2 L14.4 9 H21.5 L15.7 13.2 L17.9 20.2 L12 16.1 L6.1 20.2 L8.3 13.2 L2.5 9 H9.6 Z"/>`,
    };
  }
  return {
    viewBox: '0 0 24 24',
    inner: `<path fill="currentColor" d="M5 3 H7.2 V21 H5 Z M7.2 4.2 H18.5 L15.2 9 L18.5 13.8 H7.2 Z"/>`,
  };
}

/** Inline stamina bolt for copy / glyph catalog. */
export function hudEnergyIconSvg(em = '1.2em'): string {
  return `<svg class="copy-icon hud energy" viewBox="-5 -7 10 14" width="${em}" height="${em}" role="img" aria-label="Energy"><path fill="#f0d060" d="${STAMINA_BOLT}"/></svg>`;
}

/** Inline HP / units pip for copy / glyph catalog. */
export function hudPipIconSvg(kind: 'hp' | 'units', em = '1.2em'): string {
  const fill = kind === 'hp' ? 'var(--piece-red)' : 'var(--piece-blue)';
  const label = kind === 'hp' ? 'HP' : 'Units';
  return `<svg class="copy-icon hud pip" viewBox="0 0 8 12" width="0.58em" height="${em}" role="img" aria-label="${label}"><rect x="0.4" y="0.4" width="7.2" height="11.2" rx="1" fill="${fill}"/></svg>`;
}

/** Inline shot arrow for copy / glyph catalog. */
export function hudArrowIconSvg(em = '1.2em'): string {
  return `<svg class="copy-icon hud arrow" viewBox="-4 -7 8 14" width="${em}" height="${em}" role="img" aria-label="Arrow"><path fill="#f0d060" d="${SHOT_ARROW}"/></svg>`;
}

/** Remaining/max stamina as gold / grey lightning pips. */
export function staminaPipsHtml(left: number, max: number): string {
  if (max <= 0) return '';
  const on = Math.max(0, Math.min(max, Math.floor(left)));
  const bolts = Array.from({ length: max }, (_, i) => {
    const cls = i < on ? 'on' : 'off';
    return `<svg class="stam-pip ${cls}" viewBox="-5 -7 10 14" width="12" height="16" aria-hidden="true"><path d="${STAMINA_BOLT}"/></svg>`;
  }).join('');
  return `<span class="stam-pips" aria-label="Stamina ${on} of ${max}">${bolts}</span>`;
}

/** Arrowhead + shaft, viewBox roughly -4..4 × -7..7. */
export const SHOT_ARROW =
  'M0 -6.5 L3.6 -1.15 H1.35 V3.35 H2.55 L1.15 6.5 H-1.15 L-2.55 3.35 H-1.35 V-1.15 H-3.6 Z';

/** Shot pips — gold ready, orange reloading, grey spent. `unlimited` adds ∞ beside the arrow. */
export function shotPipsHtml(
  left: number,
  max: number,
  reloading = false,
  unlimited = false,
): string {
  if (max <= 0) return '';
  const ready = Math.max(0, Math.min(max, Math.floor(left)));
  const cooling = reloading && ready < max ? 1 : 0;
  const pips = Array.from({ length: max }, (_, i) => {
    const cls = i < ready ? 'on' : i < ready + cooling ? 'reload' : 'off';
    return `<svg class="shot-pip ${cls}" viewBox="-4 -7 8 14" width="10" height="16" aria-hidden="true"><path d="${SHOT_ARROW}"/></svg>`;
  }).join('');
  const inf = unlimited ? '<span class="shot-inf" aria-hidden="true">∞</span>' : '';
  const label = unlimited
    ? reloading
      ? 'Unlimited shots, reloading'
      : 'Unlimited shots'
    : reloading
      ? `Shots ${ready} of ${max}, reloading`
      : `Shots ${ready} of ${max}`;
  return `<span class="shot-pips" aria-label="${label}">${pips}${inf}</span>`;
}

/** Ammo pips for a piece. Unlimited guns get one arrow and ∞. */
export function pieceShotPipsHtml(piece: Piece): string {
  const s = statsOf(piece.type);
  if (s.shoot <= 0) return '';
  const reloading = isReloading(piece);
  if (s.ammo <= 0) return shotPipsHtml(reloading ? 0 : 1, 1, reloading, true);
  return shotPipsHtml(ammoLeft(piece) ?? 0, s.ammo, reloading);
}

function factionBlockPips(
  kind: 'hp' | 'units',
  left: number,
  max: number,
  side: Affiliation | 'catalog',
  label: string,
  generalFirst = false,
): string {
  if (max <= 0) return '';
  const on = Math.max(0, Math.min(max, Math.floor(left)));
  const regularOn = generalFirst ? Math.max(0, on - 1) : on;
  const bits = Array.from({ length: max }, (_, i) => {
    const isGen = generalFirst && i === 0;
    const filled = isGen ? on > 0 : generalFirst ? i - 1 < regularOn : i < on;
    return `<span class="${kind}-pip ${filled ? 'on' : 'off'}${isGen ? ' general' : ''}"></span>`;
  }).join('');
  return `<span class="${kind}-pips ${side}" aria-label="${label} ${on} of ${max}">${bits}</span>`;
}

/** Remaining / max HP as faction-colored blocks. First pip is gold if a General token. */
export function hpPipsHtml(
  left: number,
  max: number,
  side: Affiliation | 'catalog',
  generalFirst = false,
): string {
  return factionBlockPips('hp', left, max, side, 'HP', generalFirst);
}

/** Remaining activations this turn as faction-colored blocks. */
export function unitQuotaPipsHtml(acted: number, cap: number, side: Side): string {
  if (cap <= 1) return '';
  return factionBlockPips('units', Math.max(0, cap - acted), cap, side, 'Units');
}

/** Played-this-turn check — right side of the piece. */
export function actedBadgeSvg(cx: number, cy: number, r = 7): string {
  const sw = Math.max(1.4, r * 0.28);
  return `
    <g class="acted-badge" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r}" fill="#16301c" stroke="#3dba5f" stroke-width="1.3"/>
      <path d="M ${-r * 0.38} ${0.04} L ${-r * 0.08} ${r * 0.36} L ${r * 0.44} ${-r * 0.34}"
        fill="none" stroke="#7ee89a" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

/** Remaining-ammo pip — bottom-right of the piece. */
export function ammoBadgeSvg(n: number, cx: number, cy: number, r = 7): string {
  const empty = n <= 0;
  const fill = empty ? '#4a2424' : '#1a1f1c';
  const stroke = empty ? '#c66' : '#8a9488';
  const ink = empty ? '#f0b0b0' : '#e8ebe6';
  const fs = Math.max(7, r * 1.15);
  return `
    <g class="ammo-badge" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>
      <text x="0" y="0.5" text-anchor="middle" dominant-baseline="central"
        fill="${ink}" font-size="${fs}" font-weight="700">${n}</text>
    </g>`;
}

/** Ability pip — bottom-left of the piece. Star = General. */
export function abilityBadgeSvg(id: AbilityId, cx: number, cy: number, r = 7): string {
  const sw = Math.max(0.7, r * 0.12);
  const star = `M0 ${-r * 0.62} L${r * 0.18} ${-r * 0.18} H${r * 0.58} L${r * 0.24} ${r * 0.08} L${r * 0.36} ${r * 0.52} L0 ${r * 0.22} L${-r * 0.36} ${r * 0.52} L${-r * 0.24} ${r * 0.08} L${-r * 0.58} ${-r * 0.18} H${-r * 0.18} Z`;
  if (id === 'general') {
    return `
      <g class="ability-badge general" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#2a2410" stroke="#e0c070" stroke-width="1.3"/>
        <path d="${star}" fill="#f0d060" stroke="#8a7030" stroke-width="${sw}" stroke-linejoin="round"/>
      </g>`;
  }
  return '';
}

export function hiddenBadgeSvg(cx: number, cy: number, r = 7): string {
  const sw = Math.max(0.75, r * 0.14);
  const eyeRx = r * 0.46;
  const eyeRy = r * 0.28;
  return `
      <g class="ability-badge hidden" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#14201c" stroke="#6a9a88" stroke-width="1.3"/>
        <ellipse cx="0" cy="-0.15" rx="${eyeRx.toFixed(2)}" ry="${eyeRy.toFixed(2)}" fill="none" stroke="#c8e8d8" stroke-width="${sw.toFixed(2)}"/>
        <circle cx="0" cy="-0.15" r="${(r * 0.13).toFixed(2)}" fill="#c8e8d8"/>
        <path d="M ${(-r * 0.46).toFixed(2)} ${(r * 0.42).toFixed(2)} L ${(r * 0.46).toFixed(2)} ${(-r * 0.46).toFixed(2)}" fill="none" stroke="#e0c070" stroke-width="${(sw * 1.15).toFixed(2)}" stroke-linecap="round"/>
      </g>`;
}

export function exhaustedBadgeSvg(cx: number, cy: number, r = 7): string {
  const s = (r * 0.78) / 5.6;
  return `
      <g class="ability-badge exhausted" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#1c1810" stroke="#c9a227" stroke-width="1.3"/>
        <path d="${STAMINA_BOLT}" transform="scale(${s.toFixed(3)})" fill="#6a5a28"/>
      </g>`;
}

export function neutralBadgeSvg(cx: number, cy: number, r = 7): string {
  const sw = Math.max(0.85, r * 0.16);
  return `
      <g class="ability-badge neutral" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#2a2824" stroke="#8a8680" stroke-width="1.3"/>
        <circle cx="0" cy="0.1" r="${(r * 0.42).toFixed(2)}" fill="none" stroke="#d8d0c4" stroke-width="${sw.toFixed(2)}"/>
      </g>`;
}

/** Two Z's, smaller one up-right. On the piece while Sleep is active. */
export function sleepZsSvg(cx: number, cy: number, r = 7): string {
  const big = Math.max(9, r * 1.55);
  const small = big * 0.68;
  const sw = Math.max(0.7, r * 0.11);
  const letter = (x: number, y: number, fs: number) =>
    `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${fs.toFixed(2)}" font-weight="800" font-family="inherit" fill="#f4f7ff" stroke="#12151c" stroke-width="${sw.toFixed(2)}" paint-order="stroke">Z</text>`;
  return `
    <g class="sleep-zs" transform="translate(${cx}, ${cy})">
      ${letter(-r * 0.22, r * 0.18, big)}
      ${letter(r * 0.52, -r * 0.5, small)}
    </g>`;
}

export function storyBadgeSvg(cx: number, cy: number, r = 7): string {
  const w = r * 0.62;
  const h = r * 0.78;
  return `
      <g class="ability-badge story" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#2a2416" stroke="#c4a15a" stroke-width="1.3"/>
        <rect x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(r * 0.08).toFixed(2)}" fill="#e7d7a4"/>
        <path d="M${(-w * 0.28).toFixed(2)} ${(-h * 0.22).toFixed(2)} h${(w * 0.56).toFixed(2)} M${(-w * 0.28).toFixed(2)} 0 h${(w * 0.56).toFixed(2)} M${(-w * 0.28).toFixed(2)} ${(h * 0.22).toFixed(2)} h${(w * 0.34).toFixed(2)}" fill="none" stroke="#6a5430" stroke-width="${Math.max(0.6, r * 0.08).toFixed(2)}" stroke-linecap="round"/>
      </g>`;
}

export function sleepBadgeSvg(cx: number, cy: number, r = 7): string {
  const moon = r * 0.42;
  const cut = r * 0.32;
  const ox = r * 0.18;
  return `
      <g class="ability-badge sleep" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#141824" stroke="#8aa0d0" stroke-width="1.3"/>
        <path fill="#d0d8f0" fill-rule="evenodd" d="M ${(-ox).toFixed(2)} ${(-moon).toFixed(2)} A ${moon.toFixed(2)} ${moon.toFixed(2)} 0 1 0 ${(-ox).toFixed(2)} ${moon.toFixed(2)} A ${cut.toFixed(2)} ${cut.toFixed(2)} 0 1 1 ${(-ox).toFixed(2)} ${(-moon).toFixed(2)}"/>
      </g>`;
}

/** Editor swatch for a unit token. */
export function unitTokenGlyphSvg(id: UnitTokenType, size = 14): string {
  const r = size * 0.42;
  if (id === 'general') return abilityBadgeSvg('general', 0, 0, r);
  if (id === 'hidden') return hiddenBadgeSvg(0, 0, r);
  if (id === 'exhausted') return exhaustedBadgeSvg(0, 0, r);
  if (id === 'neutral') return neutralBadgeSvg(0, 0, r);
  if (id === 'sleep') return sleepBadgeSvg(0, 0, r);
  if (id === 'story') return storyBadgeSvg(0, 0, r);
  return '';
}

const STAR_PATH =
  'M0 -6.5 L1.5 -2 H6 L2.2 0.6 L3.6 5 L0 2.2 L-3.6 5 L-2.2 0.6 L-6 -2 H-1.5 Z';

/** Level-star mark. `on` gold fill, `pending` gold stroke, `off` muted. */
export function starGlyphSvg(
  kind: 'on' | 'pending' | 'off',
  size = 18,
): string {
  const fill = kind === 'on' ? '#f0d060' : 'none';
  const stroke = kind === 'off' ? '#4a5248' : '#e0c070';
  const sw = kind === 'on' ? 0.7 : 1.1;
  return `<svg class="star-glyph ${kind}" viewBox="-8 -8 16 16" width="${size}" height="${size}" aria-hidden="true">
    <path d="${STAR_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
  </svg>`;
}

export const ICON_LABEL: Record<UnitRole, string> = {
  soldier: 'infantry helmet',
  scout: 'horse',
  bazooka: 'rocket',
  sniper: 'scoped rifle',
  archer: 'bow',
  javelin: 'javelins',
  horsearcher: 'horse bow',
  chariotarcher: 'chariot bow',
  cohort: 'soldier scutum gladius',
  hoplite: 'aspis',
  elephant: 'war elephant',
  barbarian: 'axe',
  catapult: 'onager',
  tank: 'tracked hull',
  general: 'command star',
  tower: 'keep',
  dummy: 'scarecrow',
  peasant: 'fork',
  dude: 'hat',
  wolf: 'wolf',
  fighter: 'delta fighter',
  gunship: 'gunship',
  bomber: 'flying wing',
  frigate: 'frigate',
  cruiser: 'cruiser',
  dreadnought: 'dreadnought',
};
