import {
  ammoLeft,
  isPromotionToken,
  isReloading,
  MAX_UNIT_PROMOTIONS,
  PALISADE_HP,
  PROMOTION_TOKEN_COLOR,
  statsOf,
  type AbilityId,
  type Piece,
  type Affiliation,
  type PromotionTokenType,
  type Side,
  type TokenType,
  type UnitRole,
  type UnitTokenType,
} from './engine';
import { hexCorners, type HexOrientation } from './hex';
import { cornerAt, southEdges } from './heights';

export { pieceIconSvg } from './new_icons';

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
  if (type === 'grass') {
    const gs = size / 10;
    const tuft = (t: string) => `<g transform="${t}">
      <path d="M-2.2 0 Q-3.4 -1.5 -4.8 -2.6 Q-2.6 -2.2 -1.2 0 Z" fill="var(--grass-lo)"/>
      <path d="M2.2 0 Q3.4 -1.5 4.8 -2.6 Q2.6 -2.2 1.2 0 Z" fill="var(--grass-lo)"/>
      <path d="M-1.4 0 Q-2.2 -2.4 -3.6 -4.6 Q-1.4 -3.4 -0.4 0 Z" fill="var(--grass)"/>
      <path d="M1.4 0 Q2.2 -2.4 3.6 -4.6 Q1.4 -3.4 0.4 0 Z" fill="var(--grass)"/>
      <path d="M-0.7 0 Q-0.5 -3.6 0 -6 Q0.5 -3.6 0.7 0 Z" fill="var(--grass-hi)"/>
    </g>`;
    return `<g class="token-grass">
      <g transform="scale(${gs.toFixed(3)})">
        <ellipse cx="0" cy="3.4" rx="6.6" ry="2.6" fill="var(--grass-lo)" opacity="0.28"/>
        ${tuft('translate(-1.2,-0.4) scale(0.7)')}
        ${tuft('translate(3.6,-1.2) scale(0.62)')}
        ${tuft('translate(-4.2,2.2) scale(0.9)')}
        ${tuft('translate(4.4,3) scale(0.85)')}
        ${tuft('translate(0.2,5) scale(1.1)')}
      </g>
    </g>`;
  }
  if (type === 'bridge') {
    const gs = size / 10;
    return `<g class="token-bridge">
      <g transform="scale(${gs.toFixed(3)})">
        <ellipse cx="0" cy="5.6" rx="6.6" ry="1.5" fill="#0a1824" opacity="0.28"/>
        <rect x="-6.4" y="-1.1" width="12.8" height="3.4" rx="0.35" fill="var(--bridge)" stroke="var(--bridge-ink)" stroke-width="0.45"/>
        <rect x="-6.4" y="-1.1" width="12.8" height="1.05" fill="var(--bridge-hi)" opacity="0.55"/>
        <path d="M-5.6 -1.1 V2.3 M-2.8 -1.1 V2.3 M0 -1.1 V2.3 M2.8 -1.1 V2.3 M5.6 -1.1 V2.3" fill="none" stroke="var(--bridge-lo)" stroke-width="0.55"/>
        <rect x="-6.85" y="-2.35" width="1.1" height="5.9" rx="0.25" fill="var(--bridge-hi)" stroke="var(--bridge-ink)" stroke-width="0.35"/>
        <rect x="5.75" y="-2.35" width="1.1" height="5.9" rx="0.25" fill="var(--bridge-hi)" stroke="var(--bridge-ink)" stroke-width="0.35"/>
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

/** Radius of the wooden palisade / bridge base relative to the hex — clearly inset so the tile stays visible. */
export const STRUCTURE_BASE_SCALE = 0.68;

function fnum(n: number): string {
  return n.toFixed(2);
}

/** Drop shadow + south walls + wooden top, smaller than the hex, origin at the top face. */
function structureBaseSvg(
  r: number,
  lift: number,
  kind: 'palisade' | 'bridge',
  o: HexOrientation,
): string {
  const fill = kind === 'palisade' ? 'var(--palisade)' : 'var(--bridge)';
  const hi = kind === 'palisade' ? 'var(--palisade-hi)' : 'var(--bridge-hi)';
  const stroke = kind === 'palisade' ? 'var(--palisade-stroke)' : 'var(--bridge-ink)';
  const sw = Math.max(1, r * 0.06);
  const shadow = `<g class="structure-shadow">
      <polygon points="${hexCorners(0, lift + 1.6, r * 1.08, o)}" fill="#0b0906" opacity="0.28"/>
      <polygon points="${hexCorners(0.6, lift + 2.4, r * 0.92, o)}" fill="#0b0906" opacity="0.2"/>
    </g>`;
  let walls = '';
  const at = { col: 0, row: 0 };
  for (const e of southEdges(at, o)) {
    const [x1, y1] = cornerAt(0, 0, r, e.a, o);
    const [x2, y2] = cornerAt(0, 0, r, e.a + 1, o);
    walls += `<polygon class="wall-face ${kind} ${e.face} plinth" points="${fnum(x1)},${fnum(y1)} ${fnum(x2)},${fnum(y2)} ${fnum(x2)},${fnum(y2 + lift)} ${fnum(x1)},${fnum(y1 + lift)}" />`;
  }
  const top = `<polygon class="structure-top ${kind}" points="${hexCorners(0, 0, r, o)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw.toFixed(2)}" stroke-linejoin="miter"/>
    <polygon class="structure-top-hi ${kind}" points="${hexCorners(0, 0, r * 0.78, o)}" fill="${hi}" opacity="0.38"/>`;
  return `${shadow}${walls}${top}`;
}

function palisadePostSvg(x: number, h: number, w: number): string {
  const tip = Math.max(1.5, h * 0.12);
  // y=0 is the platform top; the post rises (negative y).
  return `<g class="palisade-post" transform="translate(${fnum(x)}, 0)">
    <path fill="var(--palisade-lo)" d="M${fnum(w * 0.2)} 0 L${fnum(w * 0.5)} ${fnum(-h + tip)} L${fnum(w * 1.05)} ${fnum(-h + tip * 0.65)} L${fnum(w)} 0 Z"/>
    <path fill="var(--palisade-hi)" d="M${fnum(-w)} 0 L${fnum(-w * 0.72)} ${fnum(-h + tip)} L0 ${fnum(-h)} L${fnum(w * 0.5)} ${fnum(-h + tip)} L${fnum(w * 0.2)} 0 Z"/>
  </g>`;
}

function palisadeStubSvg(x: number, h: number, w: number): string {
  return `<g class="palisade-stub" transform="translate(${fnum(x)}, 0)">
    <path fill="var(--palisade-lo)" d="M${fnum(-w)} 0 L${fnum(-w * 0.6)} ${fnum(-h)} L${fnum(w * 0.6)} ${fnum(-h)} L${fnum(w)} 0 Z"/>
  </g>`;
}

/**
 * Palisade as a 3D object on a flat tile: inset wooden base (~lift px tall) with
 * its own south wall and a drop shadow on the tile, stakes rising from the base.
 */
export function palisadeObjectSvg(
  hexSize: number,
  lift: number,
  o: HexOrientation,
  hp?: number,
): string {
  const r = hexSize * STRUCTURE_BASE_SCALE;
  const base = structureBaseSvg(r, lift, 'palisade', o);
  const left = hp ?? PALISADE_HP;
  const chips = Math.max(0, PALISADE_HP - left);
  // Six posts across the platform; damaged ones become short stubs.
  const slots = [-0.62, -0.37, -0.12, 0.12, 0.37, 0.62];
  const missing = chips >= 2 ? [2, 3] : chips >= 1 ? [2] : [];
  const h = r * 0.88;
  const w = Math.max(1.15, r * 0.08);
  let posts = '';
  let stubs = '';
  slots.forEach((t, i) => {
    const x = t * r;
    const hh = h * (0.9 + (i % 3) * 0.055);
    if (missing.includes(i)) stubs += palisadeStubSvg(x, Math.max(2.2, r * 0.16), w * 0.9);
    else posts += palisadePostSvg(x, hh, w);
  });
  if (chips >= 2) {
    // Fallen plank on the base.
    stubs += `<path fill="var(--palisade-hi)" stroke="var(--palisade-ink)" stroke-width="0.45" d="M${fnum(-r * 0.18)} ${fnum(r * 0.08)} L${fnum(r * 0.42)} ${fnum(r * 0.28)} L${fnum(r * 0.38)} ${fnum(r * 0.38)} L${fnum(-r * 0.22)} ${fnum(r * 0.16)} Z"/>`;
  }
  const railH = Math.max(1.25, r * 0.07);
  const railY = -h * 0.4;
  const rail = `<rect x="${fnum(-r * 0.66)}" y="${fnum(railY)}" width="${fnum(r * 1.32)}" height="${fnum(railH)}" rx="0.4" fill="var(--palisade-lo)" stroke="var(--palisade-ink)" stroke-width="0.5"/>`;
  return `<g class="token-palisade object${chips ? ' damaged' : ''}">${base}<g class="palisade-posts">${posts}${stubs}${rail}</g></g>`;
}

/**
 * Bridge deck as a 3D object: inset plank deck with a short south wall and a
 * shadow on the water. The water tile itself stays sunken.
 */
export function bridgeObjectSvg(
  hexSize: number,
  lift: number,
  _o: HexOrientation,
): string {
  const r = hexSize * STRUCTURE_BASE_SCALE;
  // A slightly shorter, wider deck than the palisade hex, still inset from the tile.
  const w = r * 1.05;
  const d = r * 0.42;
  const shadow = `<g class="structure-shadow">
      <ellipse cx="0" cy="${fnum(lift + 1.8)}" rx="${fnum(w * 1.06)}" ry="${fnum(d * 0.95)}" fill="#0a1824" opacity="0.4"/>
      <ellipse cx="0.4" cy="${fnum(lift + 2.6)}" rx="${fnum(w * 0.88)}" ry="${fnum(d * 0.7)}" fill="#0a1824" opacity="0.22"/>
    </g>`;
  const wall = `<polygon class="wall-face bridge s plinth" points="${fnum(-w)},${fnum(d)} ${fnum(w)},${fnum(d)} ${fnum(w)},${fnum(d + lift)} ${fnum(-w)},${fnum(d + lift)}" />`;
  const deck = `<rect x="${fnum(-w)}" y="${fnum(-d)}" width="${fnum(2 * w)}" height="${fnum(2 * d)}" rx="1.15" fill="var(--bridge)" stroke="var(--bridge-ink)" stroke-width="0.7"/>
    <rect x="${fnum(-w)}" y="${fnum(-d)}" width="${fnum(2 * w)}" height="${fnum(Math.max(1.4, d * 0.42))}" fill="var(--bridge-hi)" opacity="0.5"/>`;
  const planks: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const x = (i / 2.5) * w;
    planks.push(
      `<path d="M${fnum(x)} ${fnum(-d)} V${fnum(d)}" fill="none" stroke="var(--bridge-lo)" stroke-width="0.55"/>`,
    );
  }
  const railW = Math.max(1.1, r * 0.08);
  const rails = `<rect x="${fnum(-w - railW * 0.15)}" y="${fnum(-d - 1.1)}" width="${fnum(railW)}" height="${fnum(2 * d + 2.2)}" rx="0.3" fill="var(--bridge-hi)" stroke="var(--bridge-ink)" stroke-width="0.4"/>
    <rect x="${fnum(w - railW * 0.85)}" y="${fnum(-d - 1.1)}" width="${fnum(railW)}" height="${fnum(2 * d + 2.2)}" rx="0.3" fill="var(--bridge-hi)" stroke="var(--bridge-ink)" stroke-width="0.4"/>`;
  return `<g class="token-bridge object">${shadow}${wall}${deck}${planks.join('')}${rails}</g>`;
}

export function tutorialHandSvg(size = 16): string {
  const s = size / 18;
  return `<g class="token-tutorial" transform="scale(${s.toFixed(3)})">
    <g fill="#f7f1e4" stroke="#1a1410" stroke-width="0.7" stroke-linejoin="round" stroke-linecap="round">
      <path d="M-6.3 -8.6 H6.1 V-5.1 A2.4 2.4 0 0 1 3.6 -2.8 H-3.8 A2.4 2.4 0 0 1 -6.3 -5.1 Z"/>
      <rect x="-6.05" y="-6.5" width="3.25" height="3.7" rx="1.45"/>
      <rect x="-2.7" y="-7.7" width="3.3" height="4.5" rx="1.5"/>
      <rect x="0.65" y="-6.85" width="3.25" height="3.85" rx="1.45"/>
      <rect x="3.55" y="-5.35" width="2.7" height="2.85" rx="1.25"/>
      <rect x="-0.7" y="-2.15" width="4.9" height="11.15" rx="2.2"/>
    </g>
    <rect x="0.6" y="6.15" width="2.3" height="2.05" rx="0.7" fill="#e4cbb8" stroke="#1a1410" stroke-width="0.65"/>
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

/** Heart, viewBox roughly -6..6 × -5.4..5.2. */
export const HP_HEART =
  'M0 4.7 C0 4.7 -5.2 1.15 -5.2 -1.55 C-5.2 -3.55 -3.55 -4.85 -1.9 -4.85 C-0.95 -4.85 -0.25 -4.3 0 -3.35 C0.25 -4.3 0.95 -4.85 1.9 -4.85 C3.55 -4.85 5.2 -3.55 5.2 -1.55 C5.2 1.15 0 4.7 0 4.7 Z';

/** Lightning bolt, viewBox roughly -6..6 × -7..7 — chunkier than a needle. */
export const AP_BOLT =
  'M2.0 -5.6 L-3.5 0.15 H0.85 L-3.0 5.6 L3.7 -0.15 H-0.65 Z';

/** Gold AP bolt on a hex that will spend action points if you move there. */
export function apHexMarkSvg(cx: number, cy: number, r = 8): string {
  const s = (r * 1.15) / 5.6;
  return `
    <g class="ap-hex-mark" transform="translate(${cx}, ${cy})">
      <path d="${AP_BOLT}" transform="scale(${s.toFixed(3)})" fill="#f0d060"/>
    </g>`;
}

/** Empty AP — bolt pip with a red prohibition ring + slash. */
export function apEmptyMarkSvg(
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
    <g class="ap-empty-mark${ghost ? ' ghost' : ''}" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${ring.toFixed(2)}"/>
      <path d="${AP_BOLT}" transform="scale(${s.toFixed(3)})" fill="${bolt}"/>
      <path d="M ${(-inset).toFixed(2)} ${inset.toFixed(2)} L ${inset.toFixed(2)} ${(-inset).toFixed(2)}"
        fill="none" stroke="${stroke}" stroke-width="${slash.toFixed(2)}" stroke-linecap="round"/>
    </g>`;
}

export type ActionGlyphId =
  | 'energy'
  | 'double'
  | 'rest'
  | 'special'
  | 'end'
  | 'hide'
  | 'javelin'
  | 'charge'
  | 'lunge'
  | 'trap'
  | 'build'
  | 'palisade'
  | 'bridge'
  | 'remove'
  | 'shields'
  | 'bash'
  | 'berserk'
  | 'inspire'
  | 'reload';

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
      viewBox: '-6 -7 12 14',
      inner: `<path fill="currentColor" d="${AP_BOLT}"/>`,
    };
  }
  if (kind === 'double') {
    return {
      viewBox: '-13 -7 26 14',
      inner: `<path fill="currentColor" d="${AP_BOLT}" transform="translate(-4.8 0) scale(0.92)"/>
       <path fill="currentColor" d="${AP_BOLT}" transform="translate(4.8 0) scale(0.92)"/>`,
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
  if (kind === 'hide') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<ellipse cx="0" cy="0" rx="5.4" ry="3.2" fill="none" stroke="currentColor" stroke-width="1.35"/>
        <circle cx="0" cy="0" r="1.55" fill="currentColor"/>`,
    };
  }
  if (kind === 'javelin') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<g transform="rotate(-42)">
        <rect x="-6.2" y="-0.55" width="9.4" height="1.1" rx="0.4" fill="currentColor"/>
        <path d="M3.2 -1.7 L7.4 0 L3.2 1.7 Z" fill="currentColor"/>
      </g>`,
    };
  }
  if (kind === 'charge') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-6.2 -3.6 L-1.1 0 L-6.2 3.6 Z M-0.6 -3.6 L4.5 0 L-0.6 3.6 Z M5.1 -3.6 L7.4 0 L5.1 3.6 Z"/>`,
    };
  }
  if (kind === 'lunge') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-6.4 -0.7 H1.2 V-2.6 L7.2 0 L1.2 2.6 V0.7 H-6.4 Z"/>
        <circle cx="-4.6" cy="0" r="1.15" fill="currentColor"/>
        <circle cx="-1.2" cy="0" r="1.15" fill="currentColor"/>`,
    };
  }
  if (kind === 'trap') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-4.8 5.4 L-3.6 -5.2 L-2.2 -5.2 L-3.4 5.4 Z M-1.3 5.4 L-0.1 -5.6 L1.3 -5.6 L0.1 5.4 Z M2.2 5.4 L3.4 -5.2 L4.8 -5.2 L3.6 5.4 Z"/>`,
    };
  }
  if (kind === 'build') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-1.4 6.2 L4.6 -0.8 L6.1 0.7 L0.1 7.7 Z"/>
        <path fill="currentColor" d="M2.4 -5.2 L6.6 -1 L5.2 0.4 L1  -3.8 Z"/>
        <path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" d="M-5.6 1.2 H-1.2 M-5.6 3.4 H-1.2 M-5.6 5.6 H-1.2"/>`,
    };
  }
  if (kind === 'palisade') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-5.4 5.6 V-2.2 L-4 -4.2 L-2.6 -2.2 V5.6 Z M-1.2 5.6 V-2.2 L0.2 -4.2 L1.6 -2.2 V5.6 Z M3 5.6 V-2.2 L4.4 -4.2 L5.8 -2.2 V5.6 Z"/>`,
    };
  }
  if (kind === 'bridge') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-6.4 -1.6 H6.4 V2.2 H-6.4 Z"/>
        <path fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" d="M-4.6 -1.6 V2.2 M-1.5 -1.6 V2.2 M1.5 -1.6 V2.2 M4.6 -1.6 V2.2"/>
        <path fill="currentColor" d="M-7.1 -3.1 H-5.7 V3.7 H-7.1 Z M5.7 -3.1 H7.1 V3.7 H5.7 Z"/>`,
    };
  }
  if (kind === 'remove') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" d="M-4.2 -4.2 L4.2 4.2 M4.2 -4.2 L-4.2 4.2"/>`,
    };
  }
  if (kind === 'shields') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="none" stroke="currentColor" stroke-width="1.45" d="M0 -6.3 C3.4 -6.3 5.5 -4.5 5.5 -1.4 C5.5 2.2 2.7 5.1 0 6.7 C-2.7 5.1 -5.5 2.2 -5.5 -1.4 C-5.5 -4.5 -3.4 -6.3 0 -6.3 Z"/>
        <path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M0 -3.1 V2.5 M-2.15 -0.3 H2.15"/>`,
    };
  }
  if (kind === 'bash') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M-6.6 -1.15 H0.6 V-3.7 L6.8 0 L0.6 3.7 V1.15 H-6.6 Z"/>`,
    };
  }
  if (kind === 'berserk') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="currentColor" d="M0 -6.6 L1.15 -1.7 L6.4 -2.4 L2.15 0.7 L4.5 5.6 L0 2.5 L-4.5 5.6 L-2.15 0.7 L-6.4 -2.4 L-1.15 -1.7 Z"/>`,
    };
  }
  if (kind === 'inspire') {
    // Raised war banner with a small sunburst — rally the line.
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M-4.6 6.6 V-6.4"/>
        <path fill="currentColor" d="M-4.0 -6.2 H4.8 L2.8 -3.4 L4.8 -0.6 H-4.0 Z"/>
        <path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" d="M1.6 2.6 V5.8 M-0.4 4.2 H3.6 M0.2 2.8 L3.0 5.6 M3.0 2.8 L0.2 5.6"/>`,
    };
  }
  if (kind === 'reload') {
    return {
      viewBox: '-8 -8 16 16',
      inner: `<path fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"
          d="M 2.6 -3.4 A 4.2 4.2 0 1 1 -1.4 3.6"/>
        <path fill="currentColor" d="M1.1 -4.6 L3.2 -1.9 L4.5 -4.5 Z"/>`,
    };
  }
  return {
    viewBox: '0 0 24 24',
    inner: `<path fill="currentColor" d="M5 3 H7.2 V21 H5 Z M7.2 4.2 H18.5 L15.2 9 L18.5 13.8 H7.2 Z"/>`,
  };
}

/** Inline AP bolt for copy / glyph catalog. Glyph id `energy` still draws this. */
export function hudEnergyIconSvg(em = '1.2em'): string {
  return `<svg class="copy-icon hud energy" viewBox="-6 -7 12 14" width="${em}" height="${em}" role="img" aria-label="AP"><path fill="#f0d060" d="${AP_BOLT}"/></svg>`;
}

/** Inline HP heart / units pip for copy / glyph catalog. */
export function hudPipIconSvg(kind: 'hp' | 'units', em = '1.2em'): string {
  if (kind === 'hp') {
    return `<svg class="copy-icon hud heart" viewBox="-6 -6 12 12" width="${em}" height="${em}" role="img" aria-label="HP"><path fill="var(--piece-red)" d="${HP_HEART}"/></svg>`;
  }
  return `<svg class="copy-icon hud pip" viewBox="0 0 8 12" width="0.58em" height="${em}" role="img" aria-label="Units"><rect x="0.4" y="0.4" width="7.2" height="11.2" rx="1" fill="var(--piece-blue)"/></svg>`;
}

/** Inline shot arrow for copy / glyph catalog. */
export function hudArrowIconSvg(em = '1.2em'): string {
  return `<svg class="copy-icon hud arrow" viewBox="-4 -7 8 14" width="${em}" height="${em}" role="img" aria-label="Arrow"><path fill="#f0d060" d="${SHOT_ARROW}"/></svg>`;
}

/**
 * AP pips: spend window | storage.
 * Window L→R: keep yellow → preview red (about to spend) → spent grey.
 * Storage: banked green, then empty grey.
 * Ex: EE|EEE → hover1 ER|EEE → hover2 RR|EEE → after GG|EEE → next +1 EE|EEG.
 */
export function actionPointsPipsHtml(opts: {
  max: number;
  left: number;
  spendCap: number;
  spentThisTurn: number;
  /** How many of the remaining spendable window pips flash red (hover / pending). */
  previewSpend?: number;
}): string {
  const max = Math.max(0, Math.floor(opts.max));
  if (max <= 0) return '';
  const left = Math.max(0, Math.min(max, Math.floor(opts.left)));
  const spendCap = Math.max(0, Math.min(max, Math.floor(opts.spendCap)));
  const spentThisTurn = Math.max(0, Math.min(spendCap, Math.floor(opts.spentThisTurn)));
  const spendable = Math.min(left, Math.max(0, spendCap - spentThisTurn));
  const preview = Math.max(0, Math.min(spendable, Math.floor(opts.previewSpend ?? 0)));
  const keep = spendable - preview;
  const storageFilled = Math.max(0, left - spendable);
  const restCount = Math.max(0, max - spendCap);
  const pip = (cls: string) =>
    `<svg class="ap-pip ${cls}" viewBox="-6 -7 12 14" width="15" height="16" aria-hidden="true"><path d="${AP_BOLT}"/></svg>`;
  const windowPips = Array.from({ length: spendCap }, (_, i) => {
    if (i < keep) return pip('spendable on-spend');
    if (i < keep + preview) return pip('preview');
    if (i < keep + preview + spentThisTurn) return pip('spent empty');
    return pip('empty off');
  }).join('');
  const restPips = Array.from({ length: restCount }, (_, i) =>
    pip(i < storageFilled ? 'storage' : 'empty off'),
  ).join('');
  const window =
    spendCap > 0 ? `<span class="ap-window">${windowPips}</span>` : '';
  const split =
    spendCap > 0 && restCount > 0 ? '<span class="ap-split" aria-hidden="true"></span>' : '';
  return `<span class="ap-pips" aria-label="AP ${left} of ${max}">${window}${split}${restPips}</span>`;
}

/** Arrowhead + shaft, viewBox roughly -4..4 × -7..7. */
export const SHOT_ARROW =
  'M0 -6.5 L3.6 -1.15 H1.35 V3.35 H2.55 L1.15 6.5 H-1.15 L-2.55 3.35 H-1.35 V-1.15 H-3.6 Z';

/** Shot pips — gold ready, orange reloading, grey spent. */
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
  const label = unlimited
    ? reloading
      ? 'Unlimited shots, reloading'
      : 'Unlimited shots'
    : reloading
      ? `Shots ${ready} of ${max}, reloading`
      : `Shots ${ready} of ${max}`;
  return `<span class="shot-pips" aria-label="${label}">${pips}</span>`;
}

/** Ammo pips for a piece. Unlimited guns get one arrow (reload state only). */
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

/** Remaining / max HP as hearts. First heart is gold if a General token. */
export function hpPipsHtml(
  left: number,
  max: number,
  side: Affiliation | 'catalog',
  generalFirst = false,
): string {
  if (max <= 0) return '';
  const on = Math.max(0, Math.min(max, Math.floor(left)));
  const regularOn = generalFirst ? Math.max(0, on - 1) : on;
  const hearts = Array.from({ length: max }, (_, i) => {
    const isGen = generalFirst && i === 0;
    const filled = isGen ? on > 0 : generalFirst ? i - 1 < regularOn : i < on;
    return `<svg class="hp-pip ${filled ? 'on' : 'off'}${isGen ? ' general' : ''}" viewBox="-6 -6 12 12" aria-hidden="true"><path d="${HP_HEART}"/></svg>`;
  }).join('');
  return `<span class="hp-pips ${side}" aria-label="HP ${on} of ${max}">${hearts}</span>`;
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

/** General token pip — gold star. */
export function generalBadgeSvg(cx: number, cy: number, r = 7): string {
  const sw = Math.max(0.7, r * 0.12);
  const star = `M0 ${-r * 0.62} L${r * 0.18} ${-r * 0.18} H${r * 0.58} L${r * 0.24} ${r * 0.08} L${r * 0.36} ${r * 0.52} L0 ${r * 0.22} L${-r * 0.36} ${r * 0.52} L${-r * 0.24} ${r * 0.08} L${-r * 0.58} ${-r * 0.18} H${-r * 0.18} Z`;
  return `
      <g class="ability-badge general" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="#2a2410" stroke="#e0c070" stroke-width="1.3"/>
        <path d="${star}" fill="#f0d060" stroke="#8a7030" stroke-width="${sw}" stroke-linejoin="round"/>
      </g>`;
}

/** Ability pip — bottom-left of the piece. */
export function abilityBadgeSvg(id: AbilityId, cx: number, cy: number, r = 7): string {
  const drawn = actionGlyphDrawn(id);
  const fill =
    id === 'hide'
      ? '#14201c'
      : id === 'charge'
        ? '#2a1810'
        : id === 'lunge'
          ? '#201828'
          : id === 'javelin'
            ? '#241810'
            : id === 'shields'
              ? '#10202a'
              : id === 'bash'
                ? '#2a2010'
                : id === 'berserk'
                  ? '#2a1014'
                  : id === 'inspire'
                    ? '#2a2410'
                    : '#1c2018';
  const stroke =
    id === 'hide'
      ? '#6a9a88'
      : id === 'charge'
        ? '#e07040'
        : id === 'lunge'
          ? '#c080e0'
          : id === 'javelin'
            ? '#c9a227'
            : id === 'shields'
              ? '#7ec8ff'
              : id === 'bash'
                ? '#e0a050'
                : id === 'berserk'
                  ? '#e05050'
                  : id === 'inspire'
                    ? '#ffc857'
                    : '#8aaa70';
  return `
      <g class="ability-badge ${id}" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>
        <g transform="scale(${(r / 8).toFixed(3)})" fill="${stroke}" color="${stroke}">${drawn.inner}</g>
      </g>`;
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
        <path d="${AP_BOLT}" transform="scale(${s.toFixed(3)})" fill="#6a5a28"/>
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

/** Compact type mark under a promotion chevron (shop / select / editor). */
function promotionTypeIconInner(
  id: Exclude<PromotionTokenType, 'general'>,
  color: string,
): string {
  if (id === 'attack1') {
    // Fist
    return `<g fill="${color}">
      <path d="M-3.4 -1.1 C-3.4 -2.6 -2.3 -3.6 -0.9 -3.6 H0.4 C1.2 -3.6 1.7 -3.1 1.7 -2.4 V-0.6 H2.6 C3.4 -0.6 3.9 0 3.9 0.8 V3.2 C3.9 4.3 3.0 5.1 1.8 5.1 H-1.6 C-2.9 5.1 -3.8 4.2 -3.8 3.0 V0.2 C-3.8 -0.5 -3.4 -1.1 -3.4 -1.1 Z"/>
      <path d="M-2.6 -4.4 H-0.9 C-0.3 -4.4 0.1 -4.0 0.1 -3.4 V-2.6 H-2.6 Z"/>
      <path d="M-0.2 -4.6 H1.4 C2.0 -4.6 2.4 -4.2 2.4 -3.6 V-2.6 H-0.2 Z"/>
    </g>`;
  }
  if (id === 'defense1') {
    // Shield
    return `<path fill="none" stroke="${color}" stroke-width="1.35" stroke-linejoin="round"
      d="M0 -5.2 C2.8 -5.2 4.6 -3.7 4.6 -1.2 C4.6 1.8 2.3 4.2 0 5.4 C-2.3 4.2 -4.6 1.8 -4.6 -1.2 C-4.6 -3.7 -2.8 -5.2 0 -5.2 Z"/>
      <path fill="none" stroke="${color}" stroke-width="1.15" stroke-linecap="round" d="M0 -2.4 V2.0 M-1.8 -0.2 H1.8"/>`;
  }
  if (id === 'ap1') {
    return `<path fill="${color}" d="${AP_BOLT}" transform="scale(0.78)"/>`;
  }
  if (id === 'hp2') {
    return `<path fill="${color}" d="${HP_HEART}" transform="scale(0.72)"/>`;
  }
  if (id === 'range1') {
    // Recurve bow + nocked arrow
    return `<g fill="${color}">
      <path d="M-3.6 -5.2 C-6.4 -2.6 -6.4 2.6 -3.6 5.2 L-2.3 4.1 C-4.4 1.8 -4.4 -1.8 -2.3 -4.1 Z"/>
      <rect x="-2.4" y="-4.4" width="1.1" height="8.8" rx="0.3"/>
      <rect x="-5.2" y="-0.55" width="9.6" height="1.1" rx="0.3"/>
      <path d="M4.0 -1.9 L6.8 0 L4.0 1.9 Z"/>
    </g>`;
  }
  if (id === 'allTerrain') {
    // Pine tree
    return `<g fill="${color}">
      <path d="M0 -5.4 L3.6 -1.2 H2.0 L4.2 1.6 H2.2 L4.4 4.2 H-4.4 L-2.2 1.6 H-4.2 L-2.0 -1.2 H-3.6 Z"/>
      <rect x="-0.85" y="3.6" width="1.7" height="2.2" rx="0.25"/>
    </g>`;
  }
  if (id === 'lunge') {
    // Spear
    return `<g fill="${color}">
      <rect x="-5.6" y="-0.55" width="8.4" height="1.1" rx="0.35"/>
      <path d="M2.4 -2.1 L7.0 0 L2.4 2.1 Z"/>
      <circle cx="-4.2" cy="0" r="1.05"/>
    </g>`;
  }
  if (id === 'inspire') {
    // Banner on a pole
    return `<g fill="${color}">
      <rect x="-4.4" y="-5.4" width="1.1" height="10.8" rx="0.35"/>
      <path d="M-3.3 -5.2 H4.6 L2.6 -2.6 L4.6 0 H-3.3 Z"/>
    </g>`;
  }
  if (id === 'scout') {
    // Eye
    return `<g fill="none" stroke="${color}" stroke-width="1.25" stroke-linecap="round">
      <ellipse cx="0" cy="0" rx="5.0" ry="3.1"/>
      <circle cx="0" cy="0" r="1.35" fill="${color}" stroke="none"/>
    </g>`;
  }
  if (id === 'wealthy') {
    // Coin
    return `<g>
      <ellipse cx="0" cy="0.55" rx="4.6" ry="4.0" fill="#8a6a12"/>
      <ellipse cx="0" cy="0" rx="4.6" ry="4.0" fill="${color}" stroke="#c9a227" stroke-width="0.7"/>
      <path d="M-0.75 -1.6 V1.6 M0.75 -1.6 V1.6" fill="none" stroke="#b8860b" stroke-width="0.65" stroke-linecap="round"/>
    </g>`;
  }
  return '';
}

/**
 * Single promotion stamp: chevron on top, type icon under it.
 * Used by shop offers, action-bar select, editor swatches.
 */
export function promotionOfferGlyphSvg(
  id: Exclude<PromotionTokenType, 'general'>,
  size = 14,
): string {
  const color = PROMOTION_TOKEN_COLOR[id];
  const w = size * 0.55;
  const depth = size * 0.22;
  const sw = Math.max(1.4, size * 0.085);
  const chevronY = -size * 0.28;
  const iconScale = (size * 0.38) / 10;
  const iconY = size * 0.22;
  return `<g class="promo-offer-glyph ${id}">
    <path d="M${(-w).toFixed(2)} ${(chevronY - depth * 0.15).toFixed(2)} L0 ${(chevronY + depth).toFixed(2)} L${w.toFixed(2)} ${(chevronY - depth * 0.15).toFixed(2)}"
      fill="none" stroke="${color}" stroke-width="${sw.toFixed(2)}" stroke-linecap="square" stroke-linejoin="miter"/>
    <g transform="translate(0, ${iconY.toFixed(2)}) scale(${iconScale.toFixed(3)})">${promotionTypeIconInner(id, color)}</g>
  </g>`;
}

/** Stacked army Vs — one color per promotion, dark plate for contrast. */
export function promotionChevronsSvg(
  promos: readonly PromotionTokenType[] | number,
  cx: number,
  cy: number,
  r = 7,
): string {
  const kinds: PromotionTokenType[] =
    typeof promos === 'number'
      ? Array.from(
          {
            length: Math.max(
              0,
              Math.min(MAX_UNIT_PROMOTIONS, Math.floor(promos)),
            ),
          },
          () => 'range1',
        )
      : promos.slice(0, MAX_UNIT_PROMOTIONS);
  const n = kinds.length;
  if (n <= 0) return '';
  const w = r * 1.55;
  const step = r * 0.42;
  const depth = r * 0.55;
  const sw = Math.max(1.35, r * 0.22);
  const totalH = depth + (n - 1) * step;
  const top = -totalH / 2;
  const marks = kinds
    .map((id, i) => {
      const y0 = top + i * step;
      const y1 = y0 + depth;
      const color = PROMOTION_TOKEN_COLOR[id];
      return `<path d="M${(-w / 2).toFixed(2)} ${y0.toFixed(2)} L0 ${y1.toFixed(2)} L${(w / 2).toFixed(2)} ${y0.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(2)}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    })
    .join('');
  const padX = w / 2 + sw;
  const padY = totalH / 2 + sw * 0.7;
  return `
      <g class="ability-badge promotion" transform="translate(${cx}, ${cy})">
        <rect x="${(-padX).toFixed(2)}" y="${(-padY).toFixed(2)}" width="${(padX * 2).toFixed(2)}" height="${(padY * 2).toFixed(2)}" rx="${Math.max(1.2, r * 0.18).toFixed(2)}" fill="#1a1810" stroke="#5a4820" stroke-width="0.7"/>
        ${marks}
      </g>`;
}

/**
 * Rank stack above a unit: promotion Vs, optional general star on top.
 * General alone → just the star. Promos alone → just Vs.
 */
export function unitRankBadgesSvg(
  promos: readonly PromotionTokenType[],
  general: boolean,
  cx: number,
  cy: number,
  r = 7,
): string {
  const kinds = promos.slice(0, MAX_UNIT_PROMOTIONS);
  if (!general && kinds.length === 0) return '';
  if (general && kinds.length === 0) return generalBadgeSvg(cx, cy, r);
  const chevronR = r;
  const step = chevronR * 0.42;
  const depth = chevronR * 0.55;
  const sw = Math.max(1.35, chevronR * 0.22);
  const totalH = depth + (kinds.length - 1) * step;
  const plateHalf = totalH / 2 + sw * 0.7;
  if (!general) return promotionChevronsSvg(kinds, cx, cy, chevronR);
  const starR = r * 0.92;
  const gap = r * 0.12;
  const stackHalf = plateHalf + gap / 2 + starR;
  const chevronCy = cy + stackHalf - plateHalf;
  const starCy = cy - stackHalf + starR;
  return `${promotionChevronsSvg(kinds, cx, chevronCy, chevronR)}${generalBadgeSvg(cx, starCy, starR)}`;
}

/** Editor swatch for a unit token. */
export function unitTokenGlyphSvg(id: UnitTokenType, size = 14): string {
  const r = size * 0.42;
  if (id === 'general') return generalBadgeSvg(0, 0, r);
  if (id === 'hidden') return hiddenBadgeSvg(0, 0, r);
  if (id === 'exhausted') return exhaustedBadgeSvg(0, 0, r);
  if (id === 'neutral') return neutralBadgeSvg(0, 0, r);
  if (id === 'sleep') return sleepBadgeSvg(0, 0, r);
  if (id === 'story') return storyBadgeSvg(0, 0, r);
  if (isPromotionToken(id)) {
    // `general` already returned above — remaining promos are stackable.
    return promotionOfferGlyphSvg(
      id as Exclude<PromotionTokenType, 'general'>,
      size,
    );
  }
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

/** Gold coin for roguelite reward pile / fly FX. */
export function coinGlyphSvg(size = 22): string {
  return `<svg class="coin-glyph" viewBox="-8 -8 16 16" width="${size}" height="${size}" aria-hidden="true">
    <ellipse cx="0" cy="1.2" rx="6.4" ry="5.6" fill="#8a6a12"/>
    <ellipse cx="0" cy="0" rx="6.4" ry="5.6" fill="#f0d060" stroke="#c9a227" stroke-width="0.85"/>
    <ellipse cx="0" cy="0" rx="4.35" ry="3.75" fill="none" stroke="#d4b84a" stroke-width="0.55"/>
    <path d="M-1.1 -2.2 V2.2 M1.1 -2.2 V2.2 M-1.1 -2.2 Q0 -3.1 1.1 -2.2 M-1.1 2.2 Q0 3.1 1.1 2.2"
      fill="none" stroke="#b8860b" stroke-width="0.7" stroke-linecap="round"/>
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
  lightcavalry: 'horse javelin',
  chariotarcher: 'chariot bow',
  cohort: 'soldier scutum gladius',
  hoplite: 'aspis',
  elephant: 'war elephant',
  barbarian: 'axe',
  catapult: 'onager',
  ballista: 'torsion bolt',
  tank: 'tracked hull',
  general: 'officer',
  tower: 'keep',
  dummy: 'scarecrow',
  peasant: 'fork',
  builder: 'hammer',
  dude: 'hat',
  wolf: 'wolf',
  fighter: 'delta fighter',
  gunship: 'gunship',
  bomber: 'flying wing',
  frigate: 'frigate',
  cruiser: 'cruiser',
  dreadnought: 'dreadnought',
};
