import { roleOf, type UnitRole, type UnitType } from './engine';

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
};

export function pieceIconSvg(type: UnitType, size = 16): string {
  const s = size / 20;
  return `<g class="piece-icon" transform="scale(${s})">${ICONS[roleOf(type)]}</g>`;
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

/** Empty-stamina mark — top-right of the piece, above ammo. */
export function staminaEmptyBadgeSvg(cx: number, cy: number, r = 7): string {
  const sw = Math.max(1.1, r * 0.2);
  return `
    <g class="stamina-badge empty" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${r}" fill="#2a2414" stroke="#c9a227" stroke-width="1.3"/>
      <path d="M ${r * 0.18} ${-r * 0.55} L ${-r * 0.28} ${r * 0.05} H ${r * 0.08} L ${-r * 0.22} ${r * 0.55} L ${r * 0.32} ${-r * 0.02} H ${-r * 0.04} Z"
            fill="#e6c04a"/>
      <path d="M ${-r * 0.45} ${r * 0.42} L ${r * 0.45} ${-r * 0.42}"
            fill="none" stroke="#1a1508" stroke-width="${sw}" stroke-linecap="round"/>
    </g>`;
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

export const ICON_LABEL: Record<UnitRole, string> = {
  soldier: 'infantry helmet',
  scout: 'horse',
  bazooka: 'rocket',
  sniper: 'scoped rifle',
  tank: 'tracked hull',
  general: 'command star',
  tower: 'keep',
};
