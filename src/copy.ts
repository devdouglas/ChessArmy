import {
  TOKEN_LABEL,
  TOKEN_TYPES,
  isForestToken,
  isPalisadeToken,
  isWallToken,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_ROLE_LABEL,
  UNIT_STATS,
  UNIT_TYPES,
  type TokenType,
  type UnitCategory,
  type UnitType,
} from './engine';
import {
  hudArrowIconSvg,
  hudEnergyIconSvg,
  hudPipIconSvg,
  noTouchMarkSvg,
  pieceIconSvg,
  tokenGlyphSvg,
} from './icons';

type HudGlyphId = 'energy' | 'hp' | 'units' | 'arrow';

const HUD_GLYPHS: {
  id: HudGlyphId;
  tag: string;
  label: string;
  aliases: string[];
}[] = [
  { id: 'energy', tag: 'energy', label: 'Energy', aliases: ['stamina', 'bolt'] },
  { id: 'hp', tag: 'hp', label: 'HP', aliases: ['health', 'hitpoints'] },
  { id: 'units', tag: 'units', label: 'Units', aliases: ['unit'] },
  {
    id: 'arrow',
    tag: 'arrow',
    label: 'Arrow',
    aliases: ['shot', 'shots', 'projectile', 'projectiles', 'ammo'],
  },
];

function wrapHud(id: HudGlyphId, catalog = false): string {
  const em = catalog ? '1.85em' : '1.2em';
  if (id === 'energy') return hudEnergyIconSvg(em);
  if (id === 'hp') return hudPipIconSvg('hp', em);
  if (id === 'units') return hudPipIconSvg('units', em);
  return hudArrowIconSvg(em);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function wrapUnit(type: UnitType, catalog = false): string {
  const label = escapeHtml(UNIT_STATS[type]?.name ?? type);
  const em = catalog ? '1.85em' : '1.2em';
  return `<svg class="copy-icon" viewBox="-10 -10 20 20" width="${em}" height="${em}" role="img" aria-label="${label}"><g fill="currentColor" color="currentColor">${pieceIconSvg(type, 18)}</g></svg>`;
}

function wrapToken(type: TokenType, catalog = false): string {
  const label = escapeHtml(TOKEN_LABEL[type]);
  const em = catalog ? '1.85em' : '1.2em';
  if (isWallToken(type) || isPalisadeToken(type) || isForestToken(type)) {
    return `<svg class="copy-icon token" viewBox="-11 -11 22 22" width="${em}" height="${em}" role="img" aria-label="${label}">${tokenGlyphSvg(type, 9, 'pointy')}</svg>`;
  }
  if (type === 'notouch') {
    return `<svg class="copy-icon token" viewBox="-9 -9 18 18" width="${em}" height="${em}" role="img" aria-label="${label}">${noTouchMarkSvg(7)}</svg>`;
  }
  return `<svg class="copy-icon token" viewBox="-10 -10 20 20" width="${em}" height="${em}" role="img" aria-label="${label}">${tokenGlyphSvg(type, 16)}</svg>`;
}

function unitTag(type: UnitType): string {
  const name = UNIT_STATS[type]?.name ?? type;
  const clash = UNIT_TYPES.filter((t) => (UNIT_STATS[t]?.name ?? t) === name).length > 1;
  return clash ? type : name;
}

export type CopyGlyph = { tag: string; label: string; icon: string };
export type CopyGlyphGroup = { id: string; label: string; glyphs: CopyGlyph[] };

/** Units + tile tokens, grouped for the editor catalog. */
export function copyGlyphGroups(): CopyGlyphGroup[] {
  const hud: CopyGlyph[] = HUD_GLYPHS.map((h) => ({
    tag: h.tag,
    label: h.label,
    icon: wrapHud(h.id, true),
  }));
  const tokens: CopyGlyph[] = TOKEN_TYPES.map((t) => ({
    tag: TOKEN_LABEL[t],
    label: TOKEN_LABEL[t],
    icon: wrapToken(t, true),
  }));
  const groups: CopyGlyphGroup[] = [
    { id: 'hud', label: 'Icons', glyphs: hud },
    { id: 'tokens', label: 'Tokens', glyphs: tokens },
  ];
  for (const cat of UNIT_CATEGORIES) {
    groups.push(unitGlyphGroup(cat));
  }
  return groups;
}

function unitGlyphGroup(cat: UnitCategory): CopyGlyphGroup {
  return {
    id: cat,
    label: UNIT_CATEGORY_LABEL[cat],
    glyphs: UNIT_TYPES.filter((t) => UNIT_STATS[t]?.category === cat).map((t) => ({
      tag: unitTag(t),
      label: UNIT_STATS[t]?.name ?? t,
      icon: wrapUnit(t, true),
    })),
  };
}

function lookupCopyIcon(raw: string): string | null {
  const key = normKey(raw);
  if (!key) return null;

  for (const h of HUD_GLYPHS) {
    if (normKey(h.tag) === key || h.aliases.some((a) => normKey(a) === key)) {
      return wrapHud(h.id);
    }
  }
  for (const t of TOKEN_TYPES) {
    if (normKey(t) === key) return wrapToken(t);
  }
  for (const t of UNIT_TYPES) {
    if (normKey(t) === key) return wrapUnit(t);
  }
  for (const t of TOKEN_TYPES) {
    if (normKey(TOKEN_LABEL[t]) === key) return wrapToken(t);
  }
  if (key === 'messageboard' || key === 'message') return wrapToken('board');
  for (const t of UNIT_TYPES) {
    if (normKey(UNIT_STATS[t]?.name ?? '') === key) return wrapUnit(t);
  }
  for (const t of UNIT_TYPES) {
    const role = UNIT_STATS[t]?.role;
    if (!role) continue;
    if (normKey(role) === key || normKey(UNIT_ROLE_LABEL[role]) === key) {
      return wrapUnit(t);
    }
  }
  return null;
}

/** Escape copy, swapping `[hoplite]` / `[pikes]` for that item's icon. */
export function formatCopyHtml(text: string): string {
  return text
    .split(/(\[[^\[\]]+\])/g)
    .map((part) => {
      const m = /^\[([^\[\]]+)\]$/.exec(part);
      if (!m) return escapeHtml(part);
      return lookupCopyIcon(m[1]) ?? escapeHtml(part);
    })
    .join('');
}
