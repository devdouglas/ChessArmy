import {
  ammoLeft,
  isReloading,
  PALISADE_HP,
  roleOf,
  statsOf,
  type AbilityId,
  type Piece,
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
  // Scutum + galea
  cohort: `
    <path fill-rule="evenodd" d="M-8.6 -6.8
      Q-9.6 0 -8.6 6.8
      L-1.8 7.5
      Q-2.8 0 -1.8 -7.4
      Z
      M-5.2 0 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0"/>
    <circle cx="-5.2" cy="0" r="0.65"/>
    <path d="M2.4 -8.8 L3.8 -9.4 L4.2 -4.6 H2.2 Z"/>
    <path d="M0.8 -4.8
      Q3.2 -7.4 5.6 -4.8
      L5.8 -1.6
      L5.2 7.2 H1.2 L0.8 -1.6 Z"/>
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
  if (type === 'flag') {
    const side = owner ? ` ${owner}` : '';
    return `<g class="token-flag${side}" transform="scale(${s})">
      <ellipse cx="0.2" cy="6.4" rx="3.4" ry="1.15" fill="#1a1410" opacity="0.35"/>
      <path d="M-0.35 6.5 V-7.1" fill="none" stroke="#3a3228" stroke-width="1.35" stroke-linecap="round"/>
      <rect x="-0.85" y="-7.35" width="1.05" height="1.35" rx="0.25" fill="#c8b070"/>
      <path class="flag-cloth" d="M0.35 -6.85 L7.4 -4.15 L0.35 -1.15 Z"/>
    </g>`;
  }
  return '';
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
const STAMINA_BOLT =
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
export function staminaEmptyMarkSvg(cx: number, cy: number, r = 7): string {
  const ring = Math.max(1.35, r * 0.24);
  const slash = Math.max(1.55, r * 0.28);
  const inset = r * 0.64;
  const s = (r * 0.78) / 5.6;
  return `
    <g class="stamina-empty-mark" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r.toFixed(2)}" fill="#1a1f1c" stroke="#e04030" stroke-width="${ring.toFixed(2)}"/>
      <path d="${STAMINA_BOLT}" transform="scale(${s.toFixed(3)})" fill="#e8b840"/>
      <path d="M ${(-inset).toFixed(2)} ${inset.toFixed(2)} L ${inset.toFixed(2)} ${(-inset).toFixed(2)}"
        fill="none" stroke="#e04030" stroke-width="${slash.toFixed(2)}" stroke-linecap="round"/>
    </g>`;
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
const SHOT_ARROW =
  'M0 -6.5 L3.6 -1.15 H1.35 V3.35 H2.55 L1.15 6.5 H-1.15 L-2.55 3.35 H-1.35 V-1.15 H-3.6 Z';

/** Shot pips — gold ready, orange reloading, grey spent. */
export function shotPipsHtml(left: number, max: number, reloading = false): string {
  if (max <= 0) return '';
  const ready = Math.max(0, Math.min(max, Math.floor(left)));
  const cooling = reloading && ready < max ? 1 : 0;
  const pips = Array.from({ length: max }, (_, i) => {
    const cls = i < ready ? 'on' : i < ready + cooling ? 'reload' : 'off';
    return `<svg class="shot-pip ${cls}" viewBox="-4 -7 8 14" width="10" height="16" aria-hidden="true"><path d="${SHOT_ARROW}"/></svg>`;
  }).join('');
  const label = reloading
    ? `Shots ${ready} of ${max}, reloading`
    : `Shots ${ready} of ${max}`;
  return `<span class="shot-pips" aria-label="${label}">${pips}</span>`;
}

/** Ammo pips for a piece. Unlimited guns get one chamber pip. */
export function pieceShotPipsHtml(piece: Piece): string {
  const s = statsOf(piece.type);
  if (s.shoot <= 0) return '';
  const reloading = isReloading(piece);
  if (s.ammo <= 0) return shotPipsHtml(reloading ? 0 : 1, 1, reloading);
  return shotPipsHtml(ammoLeft(piece) ?? 0, s.ammo, reloading);
}

function factionBlockPips(
  kind: 'hp' | 'units',
  left: number,
  max: number,
  side: Side,
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
  side: Side,
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

/** Editor swatch for a unit token. */
export function unitTokenGlyphSvg(id: UnitTokenType, size = 14): string {
  const r = size * 0.42;
  if (id === 'general') return abilityBadgeSvg('general', 0, 0, r);
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
  cohort: 'scutum',
  hoplite: 'aspis',
  elephant: 'war elephant',
  barbarian: 'axe',
  catapult: 'onager',
  tank: 'tracked hull',
  general: 'command star',
  tower: 'keep',
  dummy: 'scarecrow',
  peasant: 'fork',
  fighter: 'delta fighter',
  gunship: 'gunship',
  bomber: 'flying wing',
  frigate: 'frigate',
  cruiser: 'cruiser',
  dreadnought: 'dreadnought',
};
